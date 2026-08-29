from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded


def deploy_contract():
    factory = get_contract_factory("Prolly")
    return factory.deploy()


def test_prolly_participants():
    contract = deploy_contract()

    count = contract.get_participant_count(args=[])
    assert count == 0

    result = contract.join(args=["alice"])
    assert tx_execution_succeeded(result)

    count = contract.get_participant_count(args=[])
    assert count == 1

    joined = contract.has_joined(args=["alice"])
    assert joined is True
