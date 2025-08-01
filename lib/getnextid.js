import clientPromise from "./mongodb";

export async function getNextId(sequenceName) {
  const client = await clientPromise;
  const db = client.db("robotsaz");

  const result = await db.collection("counters").findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    { returnDocument: "after", upsert: true }
  );

  return result.sequence_value;
}
