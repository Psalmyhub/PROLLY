def test_create_prolly(direct_deploy):
    contract = direct_deploy("contracts/prolly.py")

    prolly_id = contract.create_prolly(
        "Test Prolly",
        1000,
        5,
        2,
    )

    assert prolly_id == 1
    assert contract.get_entry_fee(1) == 1000
    assert contract.get_max_participants(1) == 5
    assert contract.get_winner_count(1) == 2
    assert contract.get_participant_count(1) == 0
    assert contract.is_closed(1) is False
    assert contract.are_winners_finalized(1) is False


def test_participant_order(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/prolly.py")

    contract.create_prolly(
        "Test Prolly",
        1000,
        5,
        1,
    )

    direct_vm.sender = direct_alice

    contract.join(
        1,
        str(direct_alice),
        value=1050,
    )

    direct_vm.sender = direct_bob

    contract.join(
        1,
        str(direct_bob),
        value=1050,
    )

    assert contract.get_participant_count(1) == 2

    assert contract.get_participant(1, 0) == str(direct_alice)
    assert contract.get_participant(1, 1) == str(direct_bob)

    assert contract.has_joined(1, str(direct_alice)) is True
    assert contract.has_joined(1, str(direct_bob)) is True


def test_full_prolly_closes(
    direct_vm,
    direct_deploy,
    direct_accounts,
):
    contract = direct_deploy("contracts/prolly.py")

    contract.create_prolly(
        "Full Prolly",
        1000,
        3,
        1,
    )

    for i in range(3):
        direct_vm.sender = direct_accounts[i]

        contract.join(
            1,
            str(direct_accounts[i]),
            value=1050,
        )

    assert contract.get_participant_count(1) == 3
    assert contract.is_closed(1) is True


def test_finalize_winner(
    direct_vm,
    direct_deploy,
    direct_accounts,
):
    contract = direct_deploy("contracts/prolly.py")

    contract.create_prolly(
        "Winner Test",
        1000,
        3,
        1,
    )

    for i in range(3):
        direct_vm.sender = direct_accounts[i]

        contract.join(
            1,
            str(direct_accounts[i]),
            value=1050,
        )

    # The Prolly is automatically closed at max capacity.
    assert contract.is_closed(1) is True

    # Switch back to the owner before finalizing.
    direct_vm.sender = direct_accounts[0]

    contract.finalize_winners(1)

    assert contract.are_winners_finalized(1) is True

    winner = contract.get_winner(1, 0)

    assert winner != ""
    assert winner in [
        str(direct_accounts[0]),
        str(direct_accounts[1]),
        str(direct_accounts[2]),
    ]


def test_multiple_winners_are_unique(
    direct_vm,
    direct_deploy,
    direct_accounts,
):
    contract = direct_deploy("contracts/prolly.py")

    contract.create_prolly(
        "Multi Winner Test",
        1000,
        5,
        2,
    )

    for i in range(5):
        direct_vm.sender = direct_accounts[i]

        contract.join(
            1,
            str(direct_accounts[i]),
            value=1050,
        )

    direct_vm.sender = direct_accounts[0]

    contract.finalize_winners(1)

    winner_0 = contract.get_winner(1, 0)
    winner_1 = contract.get_winner(1, 1)

    assert winner_0 != ""
    assert winner_1 != ""
    assert winner_0 != winner_1
