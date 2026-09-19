# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from datetime import datetime, timezone
import hashlib

from genlayer import *


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


class Prolly(gl.Contract):
    owner: Address
    next_prolly_id: u256

    # Platform economics
    platform_fee_bps: u256
    sponsor_fee_gen: u256
    platform_fees: u256
    sponsor_fees: u256

    # Admin / sponsor permissions
    approved_sponsors: TreeMap[str, bool]
    sponsor_applications: TreeMap[str, bool]

    # Admin + Sponsor Prolly metadata
    names: TreeMap[u256, str]
    descriptions: TreeMap[u256, str]
    entry_fees: TreeMap[u256, u256]
    max_participants: TreeMap[u256, u256]
    winner_counts: TreeMap[u256, u256]
    creator_roles: TreeMap[u256, str]
    sponsor_modes: TreeMap[u256, str]

    # Sponsor reward metadata. These are informational only; Sponsor
    # rewards are paid directly by the sponsor and are never escrowed here.
    reward_types: TreeMap[u256, str]
    reward_labels: TreeMap[u256, str]
    reward_amounts: TreeMap[u256, str]
    reward_currencies: TreeMap[u256, str]

    # Sponsor Link access
    access_expiries: TreeMap[u256, u256]
    access_token_hashes: TreeMap[u256, str]

    # Participant state
    participant_counts: TreeMap[u256, u256]
    participants: TreeMap[str, bool]
    participant_by_index: TreeMap[str, str]
    participant_order: TreeMap[str, u256]

    # Lifecycle
    closed: TreeMap[u256, bool>

    # Winner state
    winner_finalized: TreeMap[u256, bool]
    winners: TreeMap[str, str]

    # Randomness audit trail
    random_seeds: TreeMap[u256, str]

    # Admin Prolly prize accounting
    prize_pools: TreeMap[u256, u256]
    prize_per_winner: TreeMap[u256, u256]
    winner_claimed: TreeMap[str, bool]

    # On-chain Prolly identity profiles
    profiles: TreeMap[str, str]
    profile_by_username: TreeMap[str, str]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.next_prolly_id = u256(1)

        # 5% platform fee for Admin Prollys.
        self.platform_fee_bps = u256(500)

        # Intentionally configurable. The owner sets the GEN amount that
        # represents the sponsor publishing fee; no USD conversion is
        # hard-coded in the contract.
        self.sponsor_fee_gen = u256(0)

        self.platform_fees = u256(0)
        self.sponsor_fees = u256(0)

    # ============================================================
    # INTERNAL HELPERS
    # ============================================================

    def _now_timestamp(self) -> u256:
        return u256(
            int(
                datetime.now(timezone.utc).timestamp()
            )
        )

    def _hash_token(self, token: str) -> str:
        return hashlib.sha256(
            token.encode()
        ).hexdigest()

    def _is_sponsor_approved(self, wallet: Address) -> bool:
        return self.approved_sponsors.get(
            str(wallet).lower(),
            False,
        )

    def _record_participant(
        self,
        prolly_id: u256,
        participant: str,
        count: u256,
    ) -> None:
        participant_key = f"{prolly_id}:{participant.lower()}"

        if participant_key in self.participants:
            raise gl.vm.UserError(
                "Participant already joined"
            )

        index_key = f"{prolly_id}:{count}"

        self.participants[participant_key] = True
        self.participant_by_index[index_key] = participant
        self.participant_order[participant_key] = count
        self.participant_counts[prolly_id] = count + 1

    def _initialize_prolly(
        self,
        prolly_id: u256,
        name: str,
        description: str,
        entry_fee: u256,
        max_participants: u256,
        winner_count: u256,
        creator_role: str,
        sponsor_mode: str,
        reward_type: str,
        reward_label: str,
        reward_amount: str,
        reward_currency: str,
        access_expiry: u256,
        access_token_hash: str,
    ) -> None:
        self.names[prolly_id] = name
        self.descriptions[prolly_id] = description
        self.entry_fees[prolly_id] = entry_fee
        self.max_participants[prolly_id] = max_participants
        self.winner_counts[prolly_id] = winner_count
        self.creator_roles[prolly_id] = creator_role
        self.sponsor_modes[prolly_id] = sponsor_mode

        self.reward_types[prolly_id] = reward_type
        self.reward_labels[prolly_id] = reward_label
        self.reward_amounts[prolly_id] = reward_amount
        self.reward_currencies[prolly_id] = reward_currency

        self.access_expiries[prolly_id] = access_expiry
        self.access_token_hashes[prolly_id] = access_token_hash

        self.participant_counts[prolly_id] = u256(0)
        self.closed[prolly_id] = False
        self.winner_finalized[prolly_id] = False
        self.random_seeds[prolly_id] = ""

        self.prize_pools[prolly_id] = u256(0)
        self.prize_per_winner[prolly_id] = u256(0)

    def _validate_common_creation(
        self,
        name: str,
        description: str,
        max_participants: u256,
        winner_count: u256,
    ) -> None:
        if len(name.strip()) == 0:
            raise gl.vm.UserError(
                "Prolly name is required"
            )

        if len(description.strip()) == 0:
            raise gl.vm.UserError(
                "Prolly description is required"
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

    def _is_expired(self, prolly_id: u256) -> bool:
        expiry = self.access_expiries.get(
            prolly_id,
            u256(0),
        )

        if expiry == 0:
            return False

        return self._now_timestamp() >= expiry

    def _finalize_seeded_winners(
        self,
        prolly_id: u256,
    ) -> None:
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

        seed = self._get_random_seed()

        self.random_seeds[prolly_id] = seed

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

        self.winner_finalized[prolly_id] = True

        # Only Admin Prollys have on-chain prize claims.
        if self.creator_roles.get(prolly_id, "") == "admin":
            pool = self.prize_pools.get(
                prolly_id,
                u256(0),
            )
            self.prize_per_winner[prolly_id] = (
                pool // winner_count
            )

    # ============================================================
    # ADMIN / PLATFORM CONFIGURATION
    # ============================================================

    @gl.public.view
    def get_owner(self) -> str:
        return str(self.owner)

    @gl.public.view
    def get_platform_fee_bps(self) -> u256:
        return self.platform_fee_bps

    @gl.public.view
    def get_sponsor_fee_gen(self) -> u256:
        return self.sponsor_fee_gen

    @gl.public.view
    def get_platform_fees(self) -> u256:
        return self.platform_fees

    @gl.public.view
    def get_sponsor_fees(self) -> u256:
        return self.sponsor_fees

    @gl.public.write
    def set_sponsor_fee_gen(
        self,
        amount: u256,
    ) -> None:
        if self.owner != gl.message.sender_address:
            raise gl.vm.UserError(
                "Only owner can set sponsor fee"
            )

        if amount <= 0:
            raise gl.vm.UserError(
                "Sponsor fee must be greater than zero"
            )

        self.sponsor_fee_gen = amount

    # ============================================================
    # SPONSOR APPROVAL
    # ============================================================

    @gl.public.write
    def apply_sponsor(self) -> None:
        wallet = str(
            gl.message.sender_address
        ).lower()

        self.sponsor_applications[wallet] = True

    @gl.public.view
    def has_sponsor_applied(
        self,
        sponsor: str,
    ) -> bool:
        return self.sponsor_applications.get(
            sponsor.lower(),
            False,
        )

    @gl.public.write
    def set_sponsor(
        self,
        sponsor: str,
        approved: bool,
    ) -> None:
        if self.owner != gl.message.sender_address:
            raise gl.vm.UserError(
                "Only owner can manage sponsors"
            )

        wallet = str(
            Address(sponsor)
        ).lower()

        self.approved_sponsors[wallet] = approved

    @gl.public.view
    def is_sponsor(
        self,
        sponsor: str,
    ) -> bool:
        try:
            wallet = str(
                Address(sponsor)
            ).lower()
        except Exception:
            return False

        return self.approved_sponsors.get(
            wallet,
            False,
        )

    # ============================================================
    # ADMIN PROLLY CREATE
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
            raise gl.vm.UserError(
                "Only owner can create Prolly"
            )

        self._validate_common_creation(
            name,
            "Admin Prolly",
            max_participants,
            winner_count,
        )

        if entry_fee <= 0:
            raise gl.vm.UserError(
                "Entry fee must be greater than zero"
            )

        prolly_id = self.next_prolly_id
        self.next_prolly_id = prolly_id + 1

        self._initialize_prolly(
            prolly_id,
            name,
            "",
            entry_fee,
            max_participants,
            winner_count,
            "admin",
            "",
            "",
            "",
            "",
            "",
            u256(0),
            "",
        )

        return prolly_id

    # ============================================================
    # ADMIN PROLLY JOIN
    # ============================================================

    @gl.public.write.payable
    def join(
        self,
        prolly_id: u256,
        participant: str,
    ) -> None:
        if prolly_id not in self.names:
            raise gl.vm.UserError(
                "Prolly does not exist"
            )

        if self.creator_roles.get(
            prolly_id,
            "",
        ) != "admin":
            raise gl.vm.UserError(
                "Use sponsor link join for Sponsor Prollys"
            )

        if self.closed.get(
            prolly_id,
            False,
        ):
            raise gl.vm.UserError(
                "Prolly is closed"
            )

        sender = str(
            gl.message.sender_address
        )

        if participant.strip() == "":
            raise gl.vm.UserError(
                "Participant is required"
            )

        if participant.lower() != sender.lower():
            raise gl.vm.UserError(
                "Participant must match the transaction sender"
            )

        participant = sender

        count = self.participant_counts.get(
            prolly_id,
            u256(0),
        )
        limit = self.max_participants[prolly_id]

        if count >= limit:
            raise gl.vm.UserError(
                "Prolly is full"
            )

        entry_fee = self.entry_fees[prolly_id]

        if gl.message.value != entry_fee:
            raise gl.vm.UserError(
                "Incorrect payment amount"
            )

        self._record_participant(
            prolly_id,
            participant,
            count,
        )

        platform_fee = (
            entry_fee * self.platform_fee_bps
        ) // u256(10000)

        prize_contribution = (
            entry_fee - platform_fee
        )

        self.platform_fees = (
            self.platform_fees + platform_fee
        )

        self.prize_pools[prolly_id] = (
            self.prize_pools.get(
                prolly_id,
                u256(0),
            ) + prize_contribution
        )

        if count + 1 >= limit:
            self.closed[prolly_id] = True

    # ============================================================
    # SPONSOR PROLLY CREATE
    # ============================================================

    @gl.public.write.payable
    def create_sponsor_prolly(
        self,
        name: str,
        description: str,
        mode: str,
        reward_type: str,
        reward_label: str,
        reward_amount: str,
        reward_currency: str,
        max_participants: u256,
        winner_count: u256,
        lifetime_seconds: u256,
        access_token: str,
        participant_csv: str,
    ) -> u256:
        sender = gl.message.sender_address

        if not self._is_sponsor_approved(sender):
            raise gl.vm.UserError(
                "Sponsor is not approved"
            )

        sponsor_fee = self.sponsor_fee_gen

        if sponsor_fee <= 0:
            raise gl.vm.UserError(
                "Sponsor fee is not configured"
            )

        if gl.message.value != sponsor_fee:
            raise gl.vm.UserError(
                "Incorrect sponsor publishing fee"
            )

        self._validate_common_creation(
            name,
            description,
            max_participants,
            winner_count,
        )

        if mode != "link" and mode != "manual":
            raise gl.vm.UserError(
                "Sponsor mode must be link or manual"
            )

        if reward_type != "xp" and reward_type != "crypto" and reward_type != "fun" and reward_type != "other":
            raise gl.vm.UserError(
                "Invalid reward type"
            )

        if reward_type != "fun":
            if len(reward_amount.strip()) == 0:
                raise gl.vm.UserError(
                    "Reward amount is required"
                )

            if len(reward_currency.strip()) == 0:
                raise gl.vm.UserError(
                    "Reward currency or unit is required"
                )

        if mode == "link":
            if lifetime_seconds <= 0:
                raise gl.vm.UserError(
                    "Link lifetime is required"
                )

            if lifetime_seconds > 3600:
                raise gl.vm.UserError(
                    "Link lifetime cannot exceed 1 hour"
                )

            if access_token.strip() == "":
                raise gl.vm.UserError(
                    "Access token is required"
                )

            if participant_csv.strip() != "":
                raise gl.vm.UserError(
                    "Link Prolly cannot include a manual participant list"
                )

            access_expiry = (
                self._now_timestamp()
                + lifetime_seconds
            )
            access_hash = self._hash_token(
                access_token
            )

        else:
            if lifetime_seconds != 0:
                raise gl.vm.UserError(
                    "Manual Prolly cannot have an access-link lifetime"
                )

            if access_token.strip() != "":
                raise gl.vm.UserError(
                    "Manual Prolly cannot have an access token"
                )

            if participant_csv.strip() == "":
                raise gl.vm.UserError(
                    "Manual Prolly requires participants"
                )

            access_expiry = u256(0)
            access_hash = ""

        prolly_id = self.next_prolly_id
        self.next_prolly_id = prolly_id + 1

        self._initialize_prolly(
            prolly_id,
            name,
            description,
            u256(0),
            max_participants,
            winner_count,
            "sponsor",
            mode,
            reward_type,
            reward_label,
            reward_amount,
            reward_currency,
            access_expiry,
            access_hash,
        )

        self.sponsor_fees = (
            self.sponsor_fees + sponsor_fee
        )

        if mode == "manual":
            raw_participants = participant_csv.split(",")
            participant_count = u256(0)

            for raw_participant in raw_participants:
                participant = raw_participant.strip()

                if participant == "":
                    continue

                participant_address = str(
                    Address(participant)
                )

                if participant_count >= max_participants:
                    raise gl.vm.UserError(
                        "Too many manual participants"
                    )

                self._record_participant(
                    prolly_id,
                    participant_address,
                    participant_count,
                )

                participant_count = (
                    participant_count + 1
                )

            if participant_count == 0:
                raise gl.vm.UserError(
                    "Manual Prolly requires at least one participant"
                )

            if participant_count != max_participants:
                raise gl.vm.UserError(
                    "Manual participant count must equal maximum participants"
                )

            if winner_count > participant_count:
                raise gl.vm.UserError(
                    "Winner count exceeds manual participant count"
                )

            self.closed[prolly_id] = True

        return prolly_id

    # ============================================================
    # SPONSOR LINK JOIN
    # ============================================================

    @gl.public.write.payable
    def join_sponsor_link(
        self,
        prolly_id: u256,
        participant: str,
        access_token: str,
    ) -> None:
        if prolly_id not in self.names:
            raise gl.vm.UserError(
                "Prolly does not exist"
            )

        if self.creator_roles.get(
            prolly_id,
            "",
        ) != "sponsor":
            raise gl.vm.UserError(
                "This is not a Sponsor Prolly"
            )

        if self.sponsor_modes.get(
            prolly_id,
            "",
        ) != "link":
            raise gl.vm.UserError(
                "This is not a Link Prolly"
            )

        if self.closed.get(
            prolly_id,
            False,
        ):
            raise gl.vm.UserError(
                "Prolly is closed"
            )

        if self._is_expired(prolly_id):
            self.closed[prolly_id] = True
            raise gl.vm.UserError(
                "Sponsor access link has expired"
            )

        if gl.message.value != u256(0):
            raise gl.vm.UserError(
                "Sponsor participants do not pay an entry fee"
            )

        sender = str(
            gl.message.sender_address
        )

        if participant.strip() == "":
            raise gl.vm.UserError(
                "Participant is required"
            )

        if participant.lower() != sender.lower():
            raise gl.vm.UserError(
                "Participant must match the transaction sender"
            )

        expected_hash = self.access_token_hashes.get(
            prolly_id,
            "",
        )

        if self._hash_token(
            access_token
        ) != expected_hash:
            raise gl.vm.UserError(
                "Invalid sponsor access link"
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

        self._record_participant(
            prolly_id,
            sender,
            count,
        )

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

        if self.closed.get(
            prolly_id,
            False,
        ):
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
        if prolly_id not in self.names:
            raise gl.vm.UserError(
                "Prolly does not exist"
            )

        if self.winner_finalized.get(
            prolly_id,
            False,
        ):
            raise gl.vm.UserError(
                "Winners already finalized"
            )

        # Sponsor Link Prollys freeze automatically at expiry.
        if self.sponsor_modes.get(
            prolly_id,
            "",
        ) == "link":
            if self._is_expired(prolly_id):
                self.closed[prolly_id] = True

        if not self.closed.get(
            prolly_id,
            False,
        ):
            raise gl.vm.UserError(
                "Prolly is not closed"
            )

        self._finalize_seeded_winners(
            prolly_id
        )

    # ============================================================
    # ADMIN PRIZE CLAIM
    # ============================================================

    @gl.public.write
    def claim_reward(
        self,
        prolly_id: u256,
    ) -> None:
        if prolly_id not in self.names:
            raise gl.vm.UserError(
                "Prolly does not exist"
            )

        if self.creator_roles.get(
            prolly_id,
            "",
        ) != "admin":
            raise gl.vm.UserError(
                "Only Admin Prolly rewards are claimable on-chain"
            )

        if not self.winner_finalized.get(
            prolly_id,
            False,
        ):
            raise gl.vm.UserError(
                "Winners are not finalized"
            )

        sender = str(
            gl.message.sender_address
        )

        winner_count = self.winner_counts[
            prolly_id
        ]

        is_winner = False
        winner_index = u256(0)

        while winner_index < winner_count:
            winner_key = (
                f"{prolly_id}:{winner_index}"
            )

            if self.winners.get(
                winner_key,
                "",
            ).lower() == sender.lower():
                is_winner = True
                break

            winner_index = winner_index + 1

        if not is_winner:
            raise gl.vm.UserError(
                "Caller is not a winner"
            )

        claim_key = (
            f"{prolly_id}:{sender.lower()}"
        )

        if self.winner_claimed.get(
            claim_key,
            False,
        ):
            raise gl.vm.UserError(
                "Reward already claimed"
            )

        amount = self.prize_per_winner.get(
            prolly_id,
            u256(0),
        )

        if amount <= 0:
            raise gl.vm.UserError(
                "No claimable reward"
            )

        if self.balance < amount:
            raise gl.vm.UserError(
                "Insufficient contract balance"
            )

        self.winner_claimed[claim_key] = True

        _Recipient(
            Address(sender)
        ).emit_transfer(
            value=amount
        )

    # ============================================================
    # PROFILE REGISTRY
    # ============================================================

    @gl.public.write
    def register_profile(
        self,
        username: str,
    ) -> None:
        raw_username = username.strip()

        if len(raw_username) < 3 or len(raw_username) > 32:
            raise gl.vm.UserError(
                "Username must be 3 to 32 characters"
            )

        normalized = raw_username.lower()

        if not normalized.replace("_", "").replace("-", "").isalnum():
            raise gl.vm.UserError(
                "Username may contain only letters, numbers, underscore, or hyphen"
            )

        sender = str(
            gl.message.sender_address
        ).lower()

        existing = self.profiles.get(
            sender,
            "",
        )

        if existing != "":
            raise gl.vm.UserError(
                "Profile already registered"
            )

        if normalized in self.profile_by_username:
            raise gl.vm.UserError(
                "Username is already taken"
            )

        self.profiles[sender] = normalized
        self.profile_by_username[normalized] = sender

    @gl.public.view
    def get_profile(
        self,
        wallet: str,
    ) -> str:
        return self.profiles.get(
            wallet.lower(),
            "",
        )

    @gl.public.view
    def get_my_profile(self) -> str:
        return self.profiles.get(
            str(
                gl.message.sender_address
            ).lower(),
            "",
        )

    @gl.public.view
    def get_wallet_by_username(
        self,
        username: str,
    ) -> str:
        return self.profile_by_username.get(
            username.strip().lower(),
            "",
        )

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
            f"{prolly_id}:{participant.lower()}"
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
    def get_next_prolly_id(self) -> u256:
        return self.next_prolly_id

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
    def get_description(
        self,
        prolly_id: u256,
    ) -> str:
        return self.descriptions.get(
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
    def get_creator_role(
        self,
        prolly_id: u256,
    ) -> str:
        return self.creator_roles.get(
            prolly_id,
            "",
        )

    @gl.public.view
    def get_sponsor_mode(
        self,
        prolly_id: u256,
    ) -> str:
        return self.sponsor_modes.get(
            prolly_id,
            "",
        )

    @gl.public.view
    def get_reward_type(
        self,
        prolly_id: u256,
    ) -> str:
        return self.reward_types.get(
            prolly_id,
            "",
        )

    @gl.public.view
    def get_reward_label(
        self,
        prolly_id: u256,
    ) -> str:
        return self.reward_labels.get(
            prolly_id,
            "",
        )

    @gl.public.view
    def get_reward_amount(
        self,
        prolly_id: u256,
    ) -> str:
        return self.reward_amounts.get(
            prolly_id,
            "",
        )

    @gl.public.view
    def get_reward_currency(
        self,
        prolly_id: u256,
    ) -> str:
        return self.reward_currencies.get(
            prolly_id,
            "",
        )

    @gl.public.view
    def get_access_expiry(
        self,
        prolly_id: u256,
    ) -> u256:
        return self.access_expiries.get(
            prolly_id,
            u256(0),
        )

    @gl.public.view
    def is_expired(
        self,
        prolly_id: u256,
    ) -> bool:
        return self._is_expired(
            prolly_id
        )

    @gl.public.view
    def is_closed(
        self,
        prolly_id: u256,
    ) -> bool:
        if self.closed.get(
            prolly_id,
            False,
        ):
            return True

        return self._is_expired(
            prolly_id
        )

    @gl.public.view
    def get_prize_pool(
        self,
        prolly_id: u256,
    ) -> u256:
        return self.prize_pools.get(
            prolly_id,
            u256(0),
        )

    @gl.public.view
    def get_prize_per_winner(
        self,
        prolly_id: u256,
    ) -> u256:
        return self.prize_per_winner.get(
            prolly_id,
            u256(0),
        )

    @gl.public.view
    def is_reward_claimed(
        self,
        prolly_id: u256,
        winner: str,
    ) -> bool:
        return self.winner_claimed.get(
            f"{prolly_id}:{winner.lower()}",
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
