process.stdin.setEncoding("utf8"); /* encoding */
const fs = require("fs");

const args = process.argv.slice(2);

if (args.length != 1) {
  console.log("Usage albumReviewServer.js portNum");
  process.exit(1);
} else {
  const express = require("express"); /* Accessing express module */
  const portNumber = args[0];

  const app = express(); /* app is a request handler function */
  const bodyParser = require("body-parser"); /* To handle post parameters */
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
    /* on equivalent to addEventListener */
    const dataInput = process.stdin.read();

    if (dataInput !== null) {
      const command = dataInput.trim();
      if (command === "stop") {
        console.log("Shutting down the server");
        process.exit(0); /* exiting */
      } else {
        /* After invalid command, we cannot type anything else */
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

  /* Our database and collection */
  const databaseAndCollection = {
    db: process.env.MONGO_DB_NAME,
    collection: process.env.MONGO_COLLECTION,
  };

  const uri = process.env.MONGO_CONNECTION_STRING;
  const { MongoClient, ServerApiVersion } = require("mongodb");

  const client = new MongoClient(uri, {
    serverApi: ServerApiVersion.v1,
  });

  app.get("/", (request, response) => {
    response.render("../templates/index");
  });

  app.get("/review", (request, response) => {
    response.render("../templates/review");
  });

  app.post("/review", (request, response) => {
    const post_data = request.body;

    submitApplication(
      post_data.albumName,
      post_data.artist,
      post_data.description,
      post_data.rating
    );

    response.render("../templates/proccessReviews", {
      // Download album art

      albumName: post_data.albumName,
      artist: post_data.artist,
      description: post_data.description,
      rating: post_data.rating,
    });
  });

  async function submitApplication(albumName, artist, description, rating) {
    try {
      await client.connect();

      let applicaiton = {
        albumName: albumName,
        artist: artist,
        description: description,
        rating: rating,
      };

      const result = await client
        .db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .insertOne(applicaiton);
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

  async function filterRating(rating, response) {
    try {
      await client.connect();

      let filter = { rating: { $gte: rating } };

      const cursor = await client
        .db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .find(filter);

      const result = await cursor.toArray();

      let tableString = "";

      result.forEach((element) => {
        tableString +=
          "<tr><td>" +
          element.albumName +
          "</td><td>" +
          element.artist +
          "</td><td>" +
          element.rating +
          "</td></tr>";
      });

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

      result.forEach((element) => {
        tableString +=
          "<tr><td>" +
          element.albumName +
          "</td><td>" +
          element.artist +
          "</td><td>" +
          element.description +
          "</td><td>" +
          element.rating +
          "</td></tr>";
      });

      response.render("../templates/readReviews", {
        table: tableString,
      });
    } catch (e) {
      console.error(e);
    } finally {
      await client.close();
    }
  }
}
