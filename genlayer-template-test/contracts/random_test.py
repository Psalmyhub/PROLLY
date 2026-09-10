# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class RandomTest(gl.Contract):

    @gl.public.write
    def get_seed(self) -> str:
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
                break

            hash_obj.update(chunk)

        return hash_obj.hexdigest()
