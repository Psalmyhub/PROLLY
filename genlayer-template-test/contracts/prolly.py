# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class Prolly(gl.Contract):
    owner: Address
    next_prolly_id: u256

    # Prolly configuration
    names: TreeMap[u256, str]
    entry_fees: TreeMap[u256, u256]
    max_participants: TreeMap[u256, u256]
    winner_counts: TreeMap[u256, u256]

    # Participant state
    participant_counts: TreeMap[u256, u256]
    participants: TreeMap[str, bool]
    participant_by_index: TreeMap[str, str]
    participant_order: TreeMap[str, u256]

    # Lifecycle
    closed: TreeMap[u256, bool]

    # Winner state
    winner_finalized: TreeMap[u256, bool]
    winners: TreeMap[str, str]

    # Randomness audit trail
    random_seeds: TreeMap[u256, str]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.next_prolly_id = u256(1)

    # ============================================================
    # CREATE
    # ============================================================

    @gl.public.write
    def create_prolly(
        self,
        name: str,
        entry_fee: u256,
        max_participants: u256,
        winner_count: u256,
    ) -> u256:
        if self.owner != gl.message.sender_address:
            raise gl.vm.UserError("Only owner can create Prolly")

        if len(name.strip()) == 0:
            raise gl.vm.UserError("Prolly name is required")

        if entry_fee <= 0:
            raise gl.vm.UserError(
                "Entry fee must be greater than zero"
            )

        if max_participants <= 0:
            raise gl.vm.UserError(
                "Maximum participants must be greater than zero"
            )

        if winner_count <= 0:
            raise gl.vm.UserError(
                "Winner count must be greater than zero"
            )

        if winner_count > max_participants:
            raise gl.vm.UserError(
                "Winner count cannot exceed maximum participants"
            )

        prolly_id = self.next_prolly_id
        self.next_prolly_id = prolly_id + 1

        self.names[prolly_id] = name
        self.entry_fees[prolly_id] = entry_fee
        self.max_participants[prolly_id] = max_participants
        self.winner_counts[prolly_id] = winner_count

        self.participant_counts[prolly_id] = u256(0)

        self.closed[prolly_id] = False
        self.winner_finalized[prolly_id] = False
        self.random_seeds[prolly_id] = ""

        return prolly_id

    # ============================================================
    # JOIN
    # ============================================================

    @gl.public.write.payable
    def join(
        self,
        prolly_id: u256,
        participant: str,
    ) -> None:
        if prolly_id not in self.names:
            raise gl.vm.UserError("Prolly does not exist")

        if self.closed.get(prolly_id, False):
            raise gl.vm.UserError("Prolly is closed")

        if participant.strip() == "":
            raise gl.vm.UserError(
                "Participant is required"
            )

        participant_key = f"{prolly_id}:{participant}"

        if participant_key in self.participants:
            raise gl.vm.UserError(
                "Participant already joined"
            )

        count = self.participant_counts.get(
            prolly_id,
            u256(0),
        )

        limit = self.max_participants[prolly_id]

        if count >= limit:
            raise gl.vm.UserError(
                "Prolly is full"
            )

        # The participant pays exactly the configured entry fee.
        # Payment amount NEVER changes winner probability.
        entry_fee = self.entry_fees[prolly_id]

        if gl.message.value != entry_fee:
            raise gl.vm.UserError(
                "Incorrect payment amount"
            )

        # --------------------------------------------------------
        # Record participant ON-CHAIN.
        # --------------------------------------------------------

        self.participants[participant_key] = True

        index_key = f"{prolly_id}:{count}"

        self.participant_by_index[index_key] = participant
        self.participant_order[participant_key] = count

        self.participant_counts[prolly_id] = count + 1

        # --------------------------------------------------------
        # Automatically freeze the Prolly when full.
        # --------------------------------------------------------

        if count + 1 >= limit:
            self.closed[prolly_id] = True

    # ============================================================
    # CLOSE
    # ============================================================

    @gl.public.write
    def close_prolly(
        self,
        prolly_id: u256,
    ) -> None:
        if self.owner != gl.message.sender_address:
            raise gl.vm.UserError(
                "Only owner can close Prolly"
            )

        if prolly_id not in self.names:
            raise gl.vm.UserError(
                "Prolly does not exist"
            )

        if self.closed.get(prolly_id, False):
            raise gl.vm.UserError(
                "Prolly is already closed"
            )

        self.closed[prolly_id] = True

    # ============================================================
    # RANDOM SEED
    # ============================================================

    def _get_random_seed(self) -> str:
        """
        Obtain a deterministic transaction-specific seed using
        GenLayer's documented stdin-based seeded randomness approach.

        Every validator receives the same transaction input, therefore
        the derived seed is reproducible during consensus.
        """

        import os
        import hashlib

        f = os.fdopen(
            0,
            "rb",
            buffering=0,
            closefd=False,
        )

        f.seek(0)

        hash_obj = hashlib.sha256()

        while True:
            chunk = f.read(8192)

            if not chunk:
                return hash_obj.hexdigest()

            hash_obj.update(chunk)

    # ============================================================
    # RANDOM NUMBER FROM SEED
    # ============================================================

    def _random_value(
        self,
        seed: str,
        counter: u256,
    ) -> u256:
        """
        Derive a deterministic pseudo-random value from the
        GenLayer transaction seed.

        The seed itself is never supplied by the caller.
        """

        import hashlib

        material = f"{seed}:{counter}"

        digest = hashlib.sha256(
            material.encode()
        ).digest()

        value = u256(0)

        index = 0

        while index < len(digest):
            value = (
                value * u256(256)
                + u256(digest[index])
            )

            index = index + 1

        return value

    # ============================================================
    # FINALIZE WINNERS
    # ============================================================

    @gl.public.write
    def finalize_winners(
        self,
        prolly_id: u256,
    ) -> None:
        """
        Finalize the authoritative winners.

        IMPORTANT:
        - Anyone can trigger finalization.
        - The caller does NOT provide randomness.
        - The participant list is already frozen.
        - Winners are selected without replacement.
        - Winners are stored permanently on-chain.
        """

        if prolly_id not in self.names:
            raise gl.vm.UserError(
                "Prolly does not exist"
            )

        if not self.closed.get(prolly_id, False):
            raise gl.vm.UserError(
                "Prolly is not closed"
            )

        if self.winner_finalized.get(
            prolly_id,
            False,
        ):
            raise gl.vm.UserError(
                "Winners already finalized"
            )

        participant_count = self.participant_counts.get(
            prolly_id,
            u256(0),
        )

        winner_count = self.winner_counts[prolly_id]

        if participant_count == 0:
            raise gl.vm.UserError(
                "Cannot finalize a Prolly with no participants"
            )

        if winner_count > participant_count:
            raise gl.vm.UserError(
                "Winner count exceeds participant count"
            )

        # --------------------------------------------------------
        # Obtain GenLayer seeded randomness.
        # --------------------------------------------------------

        seed = self._get_random_seed()

        self.random_seeds[prolly_id] = seed

        # --------------------------------------------------------
        # Select unique winners WITHOUT replacement.
        #
        # We keep selected participant indices in memory and
        # reject duplicates.
        # --------------------------------------------------------

        selected_indices = []

        selected = u256(0)
        counter = u256(0)

        while selected < winner_count:
            random_value = self._random_value(
                seed,
                counter,
            )

            candidate_index = (
                random_value % participant_count
            )

            already_selected = False

            check_index = u256(0)

            while check_index < selected:
                if (
                    selected_indices[int(check_index)]
                    == candidate_index
                ):
                    already_selected = True
                    break

                check_index = check_index + 1

            if not already_selected:
                selected_indices.append(
                    candidate_index
                )

                participant_key = (
                    f"{prolly_id}:{candidate_index}"
                )

                winner = self.participant_by_index[
                    participant_key
                ]

                winner_key = (
                    f"{prolly_id}:{selected}"
                )

                self.winners[winner_key] = winner

                selected = selected + 1

            counter = counter + 1

        # --------------------------------------------------------
        # Winners are now authoritative and immutable.
        # --------------------------------------------------------

        self.winner_finalized[prolly_id] = True

    # ============================================================
    # PARTICIPANT READ METHODS
    # ============================================================

    @gl.public.view
    def has_joined(
        self,
        prolly_id: u256,
        participant: str,
    ) -> bool:
        if prolly_id not in self.names:
            return False

        participant_key = (
            f"{prolly_id}:{participant}"
        )

        return participant_key in self.participants

    @gl.public.view
    def get_participant(
        self,
        prolly_id: u256,
        index: u256,
    ) -> str:
        key = f"{prolly_id}:{index}"

        if key not in self.participant_by_index:
            return ""

        return self.participant_by_index[key]

    # ============================================================
    # PROLLY READ METHODS
    # ============================================================

    @gl.public.view
    def get_name(
        self,
        prolly_id: u256,
    ) -> str:
        return self.names.get(
            prolly_id,
            "",
        )

    @gl.public.view
    def get_entry_fee(
        self,
        prolly_id: u256,
    ) -> u256:
        return self.entry_fees.get(
            prolly_id,
            u256(0),
        )

    @gl.public.view
    def get_participant_count(
        self,
        prolly_id: u256,
    ) -> u256:
        return self.participant_counts.get(
            prolly_id,
            u256(0),
        )

    @gl.public.view
    def get_max_participants(
        self,
        prolly_id: u256,
    ) -> u256:
        return self.max_participants.get(
            prolly_id,
            u256(0),
        )

    @gl.public.view
    def get_winner_count(
        self,
        prolly_id: u256,
    ) -> u256:
        return self.winner_counts.get(
            prolly_id,
            u256(0),
        )

    @gl.public.view
    def is_closed(
        self,
        prolly_id: u256,
    ) -> bool:
        return self.closed.get(
            prolly_id,
            False,
        )

    # ============================================================
    # WINNER READ METHODS
    # ============================================================

    @gl.public.view
    def are_winners_finalized(
        self,
        prolly_id: u256,
    ) -> bool:
        return self.winner_finalized.get(
            prolly_id,
            False,
        )

    @gl.public.view
    def get_winner(
        self,
        prolly_id: u256,
        index: u256,
    ) -> str:
        key = f"{prolly_id}:{index}"

        if key not in self.winners:
            return ""

        return self.winners[key]

    @gl.public.view
    def get_random_seed(
        self,
        prolly_id: u256,
    ) -> str:
        return self.random_seeds.get(
            prolly_id,
            "",
        )
