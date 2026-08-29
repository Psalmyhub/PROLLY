from gltest import get_contract_factory


def deploy_contract():
    factory = get_contract_factory("WebTest")
    return factory.deploy()


def test_web_render():
    contract = deploy_contract()

    result = contract.fetch_example(args=[])

    print()
    print("===== WEB RENDER RESULT =====")
    print(result)
    print("===== END WEB RENDER RESULT =====")

    assert isinstance(result, str)
    assert len(result) > 0
    assert "Example Domain" in result

