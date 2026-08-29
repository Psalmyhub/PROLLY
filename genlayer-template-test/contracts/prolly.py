# { "Depends": "py-genlayer:test" }

from genlayer import *


class Prolly(gl.Contract):
    participants: TreeMap[str, bool]

    def __init__(self):
        self.participants = TreeMap[str, bool]()

    @gl.public.write
    def join(self, participant: str) -> None:
        if participant in self.participants:
            raise Exception("Participant already joined")

        self.participants[participant] = True

    @gl.public.view
    def has_joined(self, participant: str) -> bool:
        return self.participants.get(participant, False)

    @gl.public.view
    def get_participant_count(self) -> int:
        count = 0

        for _ in self.participants:
            count += 1

        return count
