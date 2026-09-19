from pathlib import Path

import pytest

from gltest.direct import VMContext, create_address, deploy_contract


CONTRACT_PATH = Path(__file__).resolve().parents[1] / "contracts" / "prolly.py"


@pytest.fixture(scope="module")
def deployed():
    vm = VMContext()

    owner = create_address("module-owner")
    vm.sender = owner

    contract = deploy_contract(CONTRACT_PATH, vm)

    return vm, contract, owner


@pytest.fixture
def setup(deployed, request):
    vm, contract, owner = deployed

    suffix = request.node.name

    alice = create_address(f"{suffix}-alice")
    bob = create_address(f"{suffix}-bob")
    charlie = create_address(f"{suffix}-charlie")
    dave = create_address(f"{suffix}-dave")

    return vm, contract, owner, alice, bob, charlie, dave


def address_string(address):
    return str(address)


# ============================================================
# DEPLOYMENT
# ============================================================


def test_contract_deploys_and_owner_is_correct(setup):
    vm, contract, owner, *_ = setup

    assert contract.get_owner().lower() == ("0x" + owner.hex()).lower()
    assert contract.get_next_prolly_id() == 1


# ============================================================
# ADMIN PROLLY
# ============================================================


def test_admin_can_create_prolly(setup):
    vm, contract, owner, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Admin Test",
        100,
        3,
        1,
    )

    assert prolly_id == 1
    assert contract.get_name(prolly_id) == "Admin Test"
    assert contract.get_entry_fee(prolly_id) == 100
    assert contract.get_max_participants(prolly_id) == 3
    assert contract.get_winner_count(prolly_id) == 1
    assert contract.get_creator_role(prolly_id) == "admin"
    assert contract.get_sponsor_mode(prolly_id) == ""
    assert contract.get_description(prolly_id) == ""
    assert contract.are_winners_finalized(prolly_id) is False
    assert contract.is_closed(prolly_id) is False


def test_admin_can_join_once(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Join Test",
        100,
        3,
        1,
    )

    vm.sender = alice

    vm.value = 100
    contract.join(
        prolly_id,
        address_string(alice),
    )

    assert contract.get_participant_count(prolly_id) == 1
    assert contract.has_joined(
        prolly_id,
        address_string(alice),
    ) is True

    assert contract.get_participant(
        prolly_id,
        0,
    ).lower() == address_string(alice).lower()


def test_duplicate_join_is_rejected(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Duplicate Test",
        100,
        3,
        1,
    )

    vm.sender = alice

    vm.value = 100
    contract.join(
        prolly_id,
        address_string(alice),
    )

    with pytest.raises(Exception):
        vm.value = 100
        contract.join(
            prolly_id,
            address_string(alice),
        )


def test_wrong_payment_is_rejected(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Payment Test",
        100,
        3,
        1,
    )

    vm.sender = alice

    with pytest.raises(Exception):
        vm.value = 99
        contract.join(
            prolly_id,
            address_string(alice),
        )


def test_participant_argument_must_match_sender(setup):
    vm, contract, owner, alice, bob, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Sender Test",
        100,
        3,
        1,
    )

    vm.sender = alice

    with pytest.raises(Exception):
        vm.value = 100
        contract.join(
            prolly_id,
            address_string(bob),
        )


def test_admin_prolly_auto_closes_when_full(setup):
    vm, contract, owner, alice, bob, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Full Test",
        100,
        2,
        1,
    )

    vm.sender = alice

    vm.value = 100
    contract.join(
        prolly_id,
        address_string(alice),
    )

    assert contract.is_closed(prolly_id) is False

    vm.sender = bob

    vm.value = 100
    contract.join(
        prolly_id,
        address_string(bob),
    )

    assert contract.get_participant_count(prolly_id) == 2
    assert contract.is_closed(prolly_id) is True


def test_non_owner_cannot_close_admin_prolly(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Close Permission",
        100,
        3,
        1,
    )

    vm.sender = alice

    with pytest.raises(Exception):
        contract.close_prolly(prolly_id)


def test_owner_can_close_admin_prolly(setup):
    vm, contract, owner, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Manual Close",
        100,
        3,
        1,
    )

    contract.close_prolly(prolly_id)

    assert contract.is_closed(prolly_id) is True


# ============================================================
# SPONSOR APPROVAL
# ============================================================


def test_sponsor_application_and_approval(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = alice

    assert contract.has_sponsor_applied(
        address_string(alice)
    ) is False

    contract.apply_sponsor()

    assert contract.has_sponsor_applied(
        address_string(alice)
    ) is True

    assert contract.is_sponsor(
        address_string(alice)
    ) is False

    vm.sender = owner

    contract.set_sponsor(
        address_string(alice),
        True,
    )

    assert contract.is_sponsor(
        address_string(alice)
    ) is True


def test_non_owner_cannot_approve_sponsor(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = alice

    with pytest.raises(Exception):
        contract.set_sponsor(
            address_string(alice),
            True,
        )


# ============================================================
# SPONSOR FEE
# ============================================================


def test_owner_can_configure_sponsor_fee(setup):
    vm, contract, owner, *_ = setup

    vm.sender = owner

    contract.set_sponsor_fee_gen(25)

    assert contract.get_sponsor_fee_gen() == 25


def test_non_owner_cannot_configure_sponsor_fee(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = alice

    with pytest.raises(Exception):
        contract.set_sponsor_fee_gen(25)


# ============================================================
# SPONSOR HELPERS
# ============================================================


def approve_sponsor(vm, contract, owner, sponsor):
    vm.sender = sponsor

    contract.apply_sponsor()

    vm.sender = owner

    contract.set_sponsor(
        address_string(sponsor),
        True,
    )


def configure_sponsor(vm, contract, owner, sponsor):
    approve_sponsor(
        vm,
        contract,
        owner,
        sponsor,
    )

    vm.sender = owner

    contract.set_sponsor_fee_gen(25)


# ============================================================
# SPONSOR LINK PROLLY
# ============================================================


def test_approved_sponsor_can_create_link_prolly(setup):
    vm, contract, owner, alice, *_ = setup

    configure_sponsor(
        vm,
        contract,
        owner,
        alice,
    )

    vm.sender = alice

    vm.value = 25
    prolly_id = contract.create_sponsor_prolly(
        "Sponsor Link",
        "Join our community",
        "link",
        "crypto",
        "USDT reward",
        "50",
        "USDT",
        3,
        1,
        3600,
        "SECRET123",
        "",
    )

    assert contract.get_name(prolly_id) == "Sponsor Link"
    assert contract.get_description(prolly_id) == "Join our community"
    assert contract.get_creator_role(prolly_id) == "sponsor"
    assert contract.get_sponsor_mode(prolly_id) == "link"

    assert contract.get_reward_type(prolly_id) == "crypto"
    assert contract.get_reward_label(prolly_id) == "USDT reward"
    assert contract.get_reward_amount(prolly_id) == "50"
    assert contract.get_reward_currency(prolly_id) == "USDT"

    assert contract.get_max_participants(prolly_id) == 3
    assert contract.get_winner_count(prolly_id) == 1

    assert contract.get_entry_fee(prolly_id) == 0
    assert contract.get_participant_count(prolly_id) == 0

    assert contract.get_access_expiry(prolly_id) > 0
    assert contract.is_closed(prolly_id) is False


def test_unapproved_sponsor_cannot_create_link_prolly(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = owner

    contract.set_sponsor_fee_gen(25)

    vm.sender = alice

    with pytest.raises(Exception):
        contract.create_sponsor_prolly(
            "Unauthorized Sponsor",
            "Description",
            "link",
            "xp",
            "XP reward",
            "100",
            "XP",
            3,
            1,
            3600,
            "SECRET",
            "",
        )


def test_sponsor_creation_requires_correct_fee(setup):
    vm, contract, owner, alice, *_ = setup

    approve_sponsor(
        vm,
        contract,
        owner,
        alice,
    )

    vm.sender = owner

    contract.set_sponsor_fee_gen(25)

    vm.sender = alice

    vm.value = 24

    with pytest.raises(Exception):
        contract.create_sponsor_prolly(
            "Wrong Fee",
            "Description",
            "link",
            "xp",
            "XP reward",
            "100",
            "XP",
            3,
            1,
            3600,
            "SECRET",
            "",
        )


def test_sponsor_link_participant_can_join_with_token(setup):
    vm, contract, owner, alice, bob, *_ = setup

    configure_sponsor(
        vm,
        contract,
        owner,
        alice,
    )

    vm.sender = alice

    vm.value = 25
    prolly_id = contract.create_sponsor_prolly(
        "Private Link",
        "Private sponsor pool",
        "link",
        "xp",
        "XP",
        "100",
        "XP",
        2,
        1,
        3600,
        "TOKEN123",
        "",
    )

    vm.sender = bob

    vm.value = 0
    contract.join_sponsor_link(
        prolly_id,
        address_string(bob),
        "TOKEN123",
    )

    assert contract.get_participant_count(prolly_id) == 1

    assert contract.has_joined(
        prolly_id,
        address_string(bob),
    ) is True


def test_sponsor_link_rejects_wrong_token(setup):
    vm, contract, owner, alice, bob, *_ = setup

    configure_sponsor(
        vm,
        contract,
        owner,
        alice,
    )

    vm.sender = alice

    vm.value = 25
    prolly_id = contract.create_sponsor_prolly(
        "Private Link",
        "Private sponsor pool",
        "link",
        "xp",
        "XP",
        "100",
        "XP",
        2,
        1,
        3600,
        "TOKEN123",
        "",
    )

    vm.sender = bob

    with pytest.raises(Exception):
        vm.value = 0
        contract.join_sponsor_link(
            prolly_id,
            address_string(bob),
            "WRONGTOKEN",
            )


def test_sponsor_link_participant_must_match_sender(setup):
    vm, contract, owner, alice, bob, charlie, *_ = setup

    configure_sponsor(
        vm,
        contract,
        owner,
        alice,
    )

    vm.sender = alice

    vm.value = 25
    prolly_id = contract.create_sponsor_prolly(
        "Private Link",
        "Private sponsor pool",
        "link",
        "xp",
        "XP",
        "100",
        "XP",
        2,
        1,
        3600,
        "TOKEN123",
        "",
    )

    vm.sender = bob

    with pytest.raises(Exception):
        vm.value = 0
        contract.join_sponsor_link(
            prolly_id,
            address_string(charlie),
            "TOKEN123",
            )


def test_sponsor_link_auto_closes_when_full(setup):
    vm, contract, owner, alice, bob, charlie, *_ = setup

    configure_sponsor(
        vm,
        contract,
        owner,
        alice,
    )

    vm.sender = alice

    vm.value = 25
    prolly_id = contract.create_sponsor_prolly(
        "Full Sponsor Link",
        "Community pool",
        "link",
        "xp",
        "XP",
        "100",
        "XP",
        2,
        1,
        3600,
        "TOKEN123",
        "",
    )

    vm.sender = bob

    vm.value = 0
    contract.join_sponsor_link(
        prolly_id,
        address_string(bob),
        "TOKEN123",
    )

    vm.sender = charlie

    vm.value = 0
    contract.join_sponsor_link(
        prolly_id,
        address_string(charlie),
        "TOKEN123",
    )

    assert contract.get_participant_count(prolly_id) == 2
    assert contract.is_closed(prolly_id) is True


# ============================================================
# SPONSOR MANUAL PROLLY
# ============================================================


def test_approved_sponsor_can_create_manual_prolly(setup):
    vm, contract, owner, alice, bob, charlie, *_ = setup

    configure_sponsor(
        vm,
        contract,
        owner,
        alice,
    )

    participant_csv = ",".join(
        [
            address_string(bob),
            address_string(charlie),
        ]
    )

    vm.sender = alice

    vm.value = 25
    prolly_id = contract.create_sponsor_prolly(
        "Manual Sponsor",
        "Selected participants",
        "manual",
        "fun",
        "Community reward",
        "",
        "",
        2,
        1,
        0,
        "",
        participant_csv,
    )

    assert contract.get_creator_role(prolly_id) == "sponsor"
    assert contract.get_sponsor_mode(prolly_id) == "manual"

    assert contract.get_participant_count(prolly_id) == 2
    assert contract.is_closed(prolly_id) is True

    assert contract.has_joined(
        prolly_id,
        address_string(bob),
    ) is True

    assert contract.has_joined(
        prolly_id,
        address_string(charlie),
    ) is True


# ============================================================
# PROFILES
# ============================================================


def test_register_profile_and_lookup(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = alice

    contract.register_profile("Alice")

    assert contract.get_my_profile() == "alice"

    assert contract.get_profile(
        address_string(alice)
    ) == "alice"

    assert contract.get_wallet_by_username(
        "Alice"
    ).lower() == address_string(alice).lower()


def test_profile_username_is_normalized(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = alice

    contract.register_profile("Alice_123")

    assert contract.get_my_profile() == "alice_123"

    assert contract.get_wallet_by_username(
        "ALICE_123"
    ).lower() == address_string(alice).lower()


def test_duplicate_username_is_rejected(setup):
    vm, contract, owner, alice, bob, *_ = setup

    vm.sender = alice

    contract.register_profile("sharedname")

    vm.sender = bob

    with pytest.raises(Exception):
        contract.register_profile("SharedName")


def test_wallet_cannot_register_profile_twice(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = alice

    contract.register_profile("aliceone")

    with pytest.raises(Exception):
        contract.register_profile("alicetwo")


# ============================================================
# FINALIZATION / RANDOM WINNERS
# ============================================================


def fill_admin_prolly(
    vm,
    contract,
    owner,
    participants,
    entry_fee=100,
    winner_count=1,
):
    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Finalization Test",
        entry_fee,
        len(participants),
        winner_count,
    )

    for participant in participants:
        vm.sender = participant

        vm.value = entry_fee
        contract.join(
            prolly_id,
            address_string(participant),
        )

    return prolly_id


def test_admin_winners_can_be_finalized_after_close(setup):
    vm, contract, owner, alice, bob, charlie, *_ = setup

    prolly_id = fill_admin_prolly(
        vm,
        contract,
        owner,
        [alice, bob, charlie],
        entry_fee=100,
        winner_count=2,
    )

    assert contract.is_closed(prolly_id) is True
    assert contract.are_winners_finalized(prolly_id) is False

    # Permissionless finalization.
    vm.sender = alice

    contract.finalize_winners(prolly_id)

    assert contract.are_winners_finalized(prolly_id) is True

    seed = contract.get_random_seed(prolly_id)

    assert isinstance(seed, str)
    assert len(seed) > 0


def test_finalized_winners_are_unique(setup):
    vm, contract, owner, alice, bob, charlie, dave = setup

    prolly_id = fill_admin_prolly(
        vm,
        contract,
        owner,
        [alice, bob, charlie, dave],
        entry_fee=100,
        winner_count=3,
    )

    vm.sender = dave

    contract.finalize_winners(prolly_id)

    winners = [
        contract.get_winner(prolly_id, 0),
        contract.get_winner(prolly_id, 1),
        contract.get_winner(prolly_id, 2),
    ]

    assert all(winner != "" for winner in winners)

    normalized = [
        winner.lower()
        for winner in winners
    ]

    assert len(set(normalized)) == 3


def test_finalize_cannot_run_twice(setup):
    vm, contract, owner, alice, bob, *_ = setup

    prolly_id = fill_admin_prolly(
        vm,
        contract,
        owner,
        [alice, bob],
        entry_fee=100,
        winner_count=1,
    )

    vm.sender = alice

    contract.finalize_winners(prolly_id)

    with pytest.raises(Exception):
        contract.finalize_winners(prolly_id)


def test_finalize_requires_closed_prolly(setup):
    vm, contract, owner, alice, *_ = setup

    vm.sender = owner

    prolly_id = contract.create_prolly(
        "Not Closed",
        100,
        3,
        1,
    )

    vm.sender = alice

    with pytest.raises(Exception):
        contract.finalize_winners(prolly_id)


# ============================================================
# PRIZE ACCOUNTING
# ============================================================


def test_admin_prize_pool_and_equal_prize_are_recorded(setup):
    vm, contract, owner, alice, bob, *_ = setup

    prolly_id = fill_admin_prolly(
        vm,
        contract,
        owner,
        [alice, bob],
        entry_fee=100,
        winner_count=2,
    )

    assert contract.get_prize_pool(prolly_id) == 190

    vm.sender = alice

    contract.finalize_winners(prolly_id)

    assert contract.get_prize_per_winner(prolly_id) == 95


def test_platform_fee_is_recorded(setup):
    vm, contract, owner, alice, *_ = setup

    before = contract.get_platform_fees()

    prolly_id = fill_admin_prolly(
        vm,
        contract,
        owner,
        [alice],
        entry_fee=100,
        winner_count=1,
    )

    assert contract.get_platform_fee_bps() == 500
    assert contract.get_platform_fees() - before == 5


# ============================================================
# CLAIMS
# ============================================================


def test_non_winner_cannot_claim(setup):
    vm, contract, owner, alice, bob, charlie, *_ = setup

    prolly_id = fill_admin_prolly(
        vm,
        contract,
        owner,
        [alice, bob, charlie],
        entry_fee=100,
        winner_count=1,
    )

    vm.sender = alice

    contract.finalize_winners(prolly_id)

    winner = contract.get_winner(
        prolly_id,
        0,
    )

    non_winner = None

    for participant in [alice, bob, charlie]:
        candidate = address_string(participant)

        if candidate.lower() != winner.lower():
            non_winner = participant
            break

    assert non_winner is not None

    vm.sender = non_winner

    with pytest.raises(Exception):
        contract.claim_reward(prolly_id)


def test_claimed_state_starts_false(setup):
    vm, contract, owner, alice, bob, *_ = setup

    prolly_id = fill_admin_prolly(
        vm,
        contract,
        owner,
        [alice, bob],
        entry_fee=100,
        winner_count=1,
    )

    vm.sender = alice

    contract.finalize_winners(prolly_id)

    winner = contract.get_winner(
        prolly_id,
        0,
    )

    assert winner != ""

    assert contract.is_reward_claimed(
        prolly_id,
        winner,
    ) is False
