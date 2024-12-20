process.stdin.setEncoding("utf8");
const fs = require("fs");

const args = process.argv.slice(2);

const express = require("express");
const axios = require("axios");
const portNumber = process.env.PORT || 5000;

const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.set("view engine", "ejs");

app.listen(portNumber, (err) => {
  if (err) {
    console.log("Starting server failed.");
  } else {
    console.log(
      `Web server started and running at http://localhost:${portNumber}`
    );
    console.log("Type stop to shutdown the server: ");
  }
});

process.stdin.on("readable", () => {
  const dataInput = process.stdin.read();

  if (dataInput !== null) {
    const command = dataInput.trim();
    if (command === "stop") {
      console.log("Shutting down the server");
      process.exit(0);
    } else {
      console.log(`Invalid command: ${command}`);
    }
  }

  console.log("Type stop to shutdown the server: ");
  process.stdin.resume();
});

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

const databaseAndCollection = {
  db: process.env.MONGO_DB_NAME,
  collection: process.env.MONGO_COLLECTION,
};

const uri = process.env.MONGO_CONNECTION_STRING;
const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

// Function to fetch album cover URL
async function getAlbumCover(albumName) {
  try {
    const searchResponse = await axios.get(
      `https://musicbrainz.org/ws/2/release?query=release:"${albumName}"&fmt=json`
    );
    const releases = searchResponse.data.releases;

    if (releases.length > 0) {
      const mbid = releases[0].id;
      const coverArtResponse = await axios.get(
        `https://coverartarchive.org/release/${mbid}/front`
      );

      // Return the cover art URL
      return coverArtResponse.config.url;
    } else {
      // Return a placeholder image URL if no album found
      return "https://via.placeholder.com/150";
    }
  } catch (error) {
    console.error("Error fetching album cover:", error);
    // Return a placeholder image URL in case of an error
    return "https://via.placeholder.com/150";
  }
}

app.get("/", (request, response) => {
  response.render("../templates/index");
});

app.get("/review", (request, response) => {
  response.render("../templates/review");
});

app.post("/review", (request, response) => {
  const post_data = request.body;

  let rating = post_data.rating;
  if (rating < 0) rating = 0;
  if (rating > 5) rating = 5;

  submitRating(
    post_data.albumName,
    post_data.artist,
    post_data.description,
    rating
  );

  response.render("../templates/proccessReviews", {
    albumName: post_data.albumName,
    artist: post_data.artist,
    description: post_data.description,
    rating: rating,
  });
});

async function submitRating(albumName, artist, description, rating) {
  try {
    await client.connect();

    let application = {
      albumName: albumName,
      artist: artist,
      description: description,
      rating: rating,
    };

    const result = await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .insertOne(application);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

app.get("/select", (request, response) => {
  response.render("../templates/select");
});

app.post("/select", (request, response) => {
  const post_data = request.body;

  filterRating(post_data.rating, response);
});

async function filterRating(ratingVal, response) {
  try {
    await client.connect();

    let filter = { rating: { $gte: ratingVal } };

    const cursor = await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .find(filter);

    const result = await cursor.toArray();

    let tableString = "";

    for (let element of result) {
      const coverArt = await getAlbumCover(element.albumName);
      tableString +=
        "<tr><td>" +
        element.albumName +
        "</td><td>" +
        element.artist +
        "</td><td>" +
        element.rating +
        "</td><td><img src='" +
        coverArt +
        "' alt='Album Cover' width='100'></td></tr>";
    }

    response.render("../templates/listReviews", {
      table: tableString,
    });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

app.get("/readReviews", (request, response) => {
  readReviews(response);
});

async function readReviews(response) {
  try {
    await client.connect();

    const cursor = await client
      .db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .find({});

    const result = await cursor.toArray();

    let tableString = "";

    for (let element of result) {
      const coverArt = await getAlbumCover(element.albumName);
      tableString +=
        "<tr><td>" +
        element.albumName +
        "</td><td>" +
        element.artist +
        "</td><td>" +
        element.description +
        "</td><td>" +
        element.rating +
        "</td><td><img src='" +
        coverArt +
        "' alt='Album Cover' width='100'></td></tr>";
    }

    response.render("../templates/readReviews", {
      table: tableString,
    });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
