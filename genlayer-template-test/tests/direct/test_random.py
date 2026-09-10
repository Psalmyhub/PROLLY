def test_random_seed(direct_deploy):
    contract = direct_deploy("contracts/random_test.py")

    seed = contract.get_seed()

    assert isinstance(seed, str)
    assert len(seed) == 64
    assert seed != ""
