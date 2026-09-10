from gltest import get_contract_factory, get_default_account
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded


def deploy_contract():
    factory = get_contract_factory("Prolly")
    return factory.deploy()


def test_create_prolly():
    contract = load_fixture(deploy_contract)

    result = contract.create_prolly(
        args=["Test Prolly", 100, 3, 1]
    )

    assert tx_execution_succeeded(result)

    assert contract.get_entry_fee(args=[1]) == 100
    assert contract.get_max_participants(args=[1]) == 3
    assert contract.get_winner_count(args=[1]) == 1
    assert contract.get_participant_count(args=[1]) == 0
    assert contract.is_closed(args=[1]) is False
    assert contract.are_winners_finalized(args=[1]) is False


def test_join_prolly():
    contract = load_fixture(deploy_contract)

    create_result = contract.create_prolly(
        args=["Join Test", 100, 3, 1]
    )
    assert tx_execution_succeeded(create_result)

    account = get_default_account()

    join_result = contract.join(
        args=[1, account.address],
        value=105,
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


def test_duplicate_join_rejected():
    contract = load_fixture(deploy_contract)

    create_result = contract.create_prolly(
        args=["Duplicate Test", 100, 3, 1]
    )
    assert tx_execution_succeeded(create_result)

    account = get_default_account()

    first_join = contract.join(
        args=[1, account.address],
        value=105,
    )
    assert tx_execution_succeeded(first_join)

    second_join = contract.join(
        args=[1, account.address],
        value=105,
    )

    assert not tx_execution_succeeded(second_join)


def test_prolly_closes_when_full():
    contract = load_fixture(deploy_contract)

    create_result = contract.create_prolly(
        args=["Full Test", 100, 1, 1]
    )
    assert tx_execution_succeeded(create_result)

    account = get_default_account()

    join_result = contract.join(
        args=[1, account.address],
        value=105,
    )
    assert tx_execution_succeeded(join_result)

    assert contract.get_participant_count(args=[1]) == 1
    assert contract.is_closed(args=[1]) is True


def test_finalize_winner():
    contract = load_fixture(deploy_contract)

    create_result = contract.create_prolly(
        args=["Winner Test", 100, 2, 1]
    )
    assert tx_execution_succeeded(create_result)

    account = get_default_account()

    join_result = contract.join(
        args=[1, account.address],
        value=105,
    )
    assert tx_execution_succeeded(join_result)

    close_result = contract.close_prolly(args=[1])
    assert tx_execution_succeeded(close_result)

    finalize_result = contract.finalize_winners(args=[1])
    assert tx_execution_succeeded(finalize_result)

    assert contract.are_winners_finalized(args=[1]) is True

    winner = contract.get_winner(args=[1, 0])

    assert winner == account.address
