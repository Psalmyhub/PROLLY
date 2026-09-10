import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT =
  "0x64362180Ff8AF758698AA2c3F4ED3AA19b72aFB1" as `0x${string}`;

const client = createClient({
  chain: studionet,
  endpoint:
    "https://studio.genlayer.com/api",
});

async function read(
  functionName: string,
  args: any[] = [],
) {
  return client.readContract({
    address: CONTRACT,
    functionName,
    args,
  });
}

async function main() {
  console.log(
    "======================================",
  );
  console.log(
    "PROLLY V2 STUDIO READ TEST",
  );
  console.log(
    "======================================",
  );

  console.log(
    "Contract:",
    CONTRACT,
  );

  const owner =
    await read("get_owner");

  const nextId =
    await read(
      "get_next_prolly_id",
    );

  const name =
    await read(
      "get_name",
      [1],
    );

  const entryFee =
    await read(
      "get_entry_fee",
      [1],
    );

  const maxParticipants =
    await read(
      "get_max_participants",
      [1],
    );

  const winnerCount =
    await read(
      "get_winner_count",
      [1],
    );

  const participantCount =
    await read(
      "get_participant_count",
      [1],
    );

  const prizePool =
    await read(
      "get_prize_pool",
      [1],
    );

  const platformFee =
    await read(
      "get_platform_fee",
      [1],
    );

  const closed =
    await read(
      "is_closed",
      [1],
    );

  const finalized =
    await read(
      "are_winners_finalized",
      [1],
    );

  const winner =
    await read(
      "get_winner",
      [1, 0],
    );

  const winnerPrize =
    await read(
      "get_winner_prize",
      [1, 0],
    );

  const claimed =
    await read(
      "is_winner_claimed",
      [1, 0],
    );

  console.log("");
  console.log("Owner:", owner);
  console.log(
    "Next Prolly ID:",
    nextId,
  );
  console.log("Name:", name);
  console.log(
    "Entry fee:",
    entryFee,
  );
  console.log(
    "Max participants:",
    maxParticipants,
  );
  console.log(
    "Winner count:",
    winnerCount,
  );
  console.log(
    "Participant count:",
    participantCount,
  );
  console.log(
    "Prize pool:",
    prizePool,
  );
  console.log(
    "Platform fee:",
    platformFee,
  );
  console.log(
    "Closed:",
    closed,
  );
  console.log(
    "Winners finalized:",
    finalized,
  );
  console.log(
    "Winner #0:",
    winner,
  );
  console.log(
    "Winner #0 prize:",
    winnerPrize,
  );
  console.log(
    "Winner #0 claimed:",
    claimed,
  );

  console.log("");
  console.log(
    "READ TEST COMPLETE",
  );
}

main().catch((error) => {
  console.error("");
  console.error(
    "STUDIO TEST FAILED",
  );
  console.error(error);
  process.exit(1);
});
