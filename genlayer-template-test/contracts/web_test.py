# { "Depends": "py-genlayer:test" }

from genlayer import *


class WebTest(gl.Contract):

    @gl.public.view
    def fetch_example(self) -> str:
        result = gl.web.render(
            "https://example.com",
            mode="text",
            wait_after_loaded=0,
        )

        return result.text
