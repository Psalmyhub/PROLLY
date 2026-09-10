from gltest import get_contract_factory, get_accounts
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded


def deploy_contract():
    factory = get_contract_factory("ProllyV2")
    return factory.deploy()


def test_create_prolly():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Test Prolly", 100, 3, 1]
    )

    assert tx_execution_succeeded(result)

    assert contract.get_name(args=[1]) == "Test Prolly"
    assert contract.get_entry_fee(args=[1]) == 100
    assert contract.get_max_participants(args=[1]) == 3
    assert contract.get_winner_count(args=[1]) == 1
    assert contract.get_participant_count(args=[1]) == 0
    assert contract.get_prize_pool(args=[1]) == 0
    assert contract.is_closed(args=[1]) is False
    assert contract.are_winners_finalized(args=[1]) is False


def test_join_uses_sender_and_updates_pool():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Join Test", 100, 3, 1]
    )

    assert tx_execution_succeeded(result)

    account = get_accounts()[0]

    join_result = contract.join(
        args=[1],
        value=105,
        from_=account,
    )

    assert tx_execution_succeeded(join_result)

    assert contract.has_joined(
        args=[1, account.address]
    ) is True

    assert contract.get_participant_count(
        args=[1]
    ) == 1

    assert contract.get_participant(
        args=[1, 0]
    ) == account.address

    assert contract.get_prize_pool(
        args=[1]
    ) == 100


def test_duplicate_join_rejected():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Duplicate Test", 100, 3, 1]
    )

    assert tx_execution_succeeded(result)

    account = get_accounts()[0]

    first_join = contract.join(
        args=[1],
        value=105,
        from_=account,
    )

    assert tx_execution_succeeded(first_join)

    second_join = contract.join(
        args=[1],
        value=105,
        from_=account,
    )

    assert not tx_execution_succeeded(second_join)

    assert contract.get_participant_count(
        args=[1]
    ) == 1


def test_multiple_participants_are_stored_in_order():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Multi Test", 100, 3, 1]
    )

    assert tx_execution_succeeded(result)

    accounts = get_accounts()

    first = accounts[0]
    second = accounts[1]

    first_join = contract.join(
        args=[1],
        value=105,
        from_=first,
    )

    second_join = contract.join(
        args=[1],
        value=105,
        from_=second,
    )

    assert tx_execution_succeeded(first_join)
    assert tx_execution_succeeded(second_join)

    assert contract.get_participant(
        args=[1, 0]
    ) == first.address

    assert contract.get_participant(
        args=[1, 1]
    ) == second.address

    assert contract.get_participant_count(
        args=[1]
    ) == 2

    assert contract.get_prize_pool(
        args=[1]
    ) == 200


def test_prolly_closes_when_full():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Full Test", 100, 1, 1]
    )

    assert tx_execution_succeeded(result)

    account = get_accounts()[0]

    join_result = contract.join(
        args=[1],
        value=105,
        from_=account,
    )

    assert tx_execution_succeeded(join_result)

    assert contract.get_participant_count(
        args=[1]
    ) == 1

    assert contract.is_closed(
        args=[1]
    ) is True


def test_join_rejects_wrong_payment():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Payment Test", 100, 3, 1]
    )

    assert tx_execution_succeeded(result)

    account = get_accounts()[0]

    result = contract.join(
        args=[1],
        value=100,
        from_=account,
    )

    assert not tx_execution_succeeded(result)

    assert contract.get_participant_count(
        args=[1]
    ) == 0


def test_finalize_single_winner():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Winner Test", 100, 2, 1]
    )

    assert tx_execution_succeeded(result)

    accounts = get_accounts()

    first = accounts[0]
    second = accounts[1]

    first_join = contract.join(
        args=[1],
        value=105,
        from_=first,
    )

    second_join = contract.join(
        args=[1],
        value=105,
        from_=second,
    )

    assert tx_execution_succeeded(first_join)
    assert tx_execution_succeeded(second_join)

    assert contract.is_closed(
        args=[1]
    ) is True

    finalize_result = contract.finalize_winners(
        args=[1]
    )

    assert tx_execution_succeeded(finalize_result)

    assert contract.are_winners_finalized(
        args=[1]
    ) is True

    winner = contract.get_winner(
        args=[1, 0]
    )

    assert winner in [
        first.address,
        second.address,
    ]

    assert contract.get_winner_prize(
        args=[1, 0]
    ) == 200


def test_multiple_winners_receive_equal_prizes():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Multi Winner Test", 100, 4, 2]
    )

    assert tx_execution_succeeded(result)

    accounts = get_accounts()

    for account in accounts[:4]:
        join_result = contract.join(
            args=[1],
            value=105,
            from_=account,
        )

        assert tx_execution_succeeded(join_result)

    assert contract.get_prize_pool(
        args=[1]
    ) == 400

    assert contract.is_closed(
        args=[1]
    ) is True

    finalize_result = contract.finalize_winners(
        args=[1]
    )

    assert tx_execution_succeeded(finalize_result)

    winner_one = contract.get_winner(
        args=[1, 0]
    )

    winner_two = contract.get_winner(
        args=[1, 1]
    )

    assert winner_one != ""
    assert winner_two != ""
    assert winner_one != winner_two

    assert contract.get_winner_prize(
        args=[1, 0]
    ) == 200

    assert contract.get_winner_prize(
        args=[1, 1]
    ) == 200


def test_winners_cannot_be_finalized_twice():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Finalize Test", 100, 1, 1]
    )

    assert tx_execution_succeeded(result)

    account = get_accounts()[0]

    join_result = contract.join(
        args=[1],
        value=105,
        from_=account,
    )

    assert tx_execution_succeeded(join_result)

    first_finalize = contract.finalize_winners(
        args=[1]
    )

    assert tx_execution_succeeded(first_finalize)

    second_finalize = contract.finalize_winners(
        args=[1]
    )

    assert not tx_execution_succeeded(second_finalize)


def test_non_winner_cannot_claim():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Claim Test", 100, 2, 1]
    )

    assert tx_execution_succeeded(result)

    accounts = get_accounts()

    first = accounts[0]
    second = accounts[1]

    assert tx_execution_succeeded(
        contract.join(
            args=[1],
            value=105,
            from_=first,
        )
    )

    assert tx_execution_succeeded(
        contract.join(
            args=[1],
            value=105,
            from_=second,
        )
    )

    assert tx_execution_succeeded(
        contract.finalize_winners(
            args=[1]
        )
    )

    winner = contract.get_winner(
        args=[1, 0]
    )

    non_winner = (
        second
        if winner == first.address
        else first
    )

    claim = contract.claim_winner(
        args=[1, 0],
        from_=non_winner,
    )

    assert not tx_execution_succeeded(claim)


def test_winner_can_claim_once():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Claim Winner Test", 100, 1, 1]
    )

    assert tx_execution_succeeded(result)

    account = get_accounts()[0]

    assert tx_execution_succeeded(
        contract.join(
            args=[1],
            value=105,
            from_=account,
        )
    )

    assert tx_execution_succeeded(
        contract.finalize_winners(
            args=[1]
        )
    )

    assert contract.get_winner(
        args=[1, 0]
    ) == account.address

    claim = contract.claim_winner(
        args=[1, 0],
        from_=account,
    )

    assert tx_execution_succeeded(claim)

    assert contract.is_winner_claimed(
        args=[1, 0]
    ) is True

    second_claim = contract.claim_winner(
        args=[1, 0],
        from_=account,
    )

    assert not tx_execution_succeeded(second_claim)
