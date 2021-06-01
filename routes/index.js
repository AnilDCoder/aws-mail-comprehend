var inbox = require("inbox");
const fs = require("fs");
var AWS = require("aws-sdk");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(
  "1LLTd_mZXTUoSG_eRth_b3daRi5SNThfm6ZZfhGDQ06g"
);

const creds = require("../google_client.json");
const { promisify } = require("util");
const simpleParser = require("mailparser").simpleParser;

var comprehend = new AWS.Comprehend({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});
module.exports = function (app, io) {
  var socketio = io;

  let messagesArr = [];
  let titles = [];
  setEmit(socketio, messagesArr);
  var client = inbox.createConnection(
    process.env.IMAP_PORT,
    process.env.IMAP_HOST,
    {
      secureConnection: true,
      auth: {
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASS,
      },
    }
  );

  client.connect();

  client.on("connect", function () {
    console.log("Successfully connected to imap");
    // client.openMailbox("INBOX", function (error, mailbox) {
    //   if (error) throw error;
    //   client.listMessages(-10, function (err, messages) {
    //     messages.forEach(function (message) {
    //       console.log(message.UID + ": " + message.title);
    //       messagesArr.push(message);
    //     });
    //     setEmit(socketio, messagesArr);
    //   });
    // });
    // client.on("new", function (message) {
    //   console.log("New incoming message " + message.title);
    //   messagesArr.push(message);
    //   setEmit(socketio, messagesArr);
    // });
  });

  app.get("/reset", function (req, res) {
    var socketio = req.app.get("socketio");
    setEmit(socketio, []);
  });

  app.get("/titles", async function (req, res) {
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();
    console.log(doc.title);
    const sheet = await doc.addSheet({ headerValues: ["name"] });
    client.openMailbox("INBOX", function (error, mailbox) {
      if (error) throw error;
      client.listMessages(-mailbox.length, async function (err, messages) {
        var promiseArray = [];
        for (var i = 0; i < messages.length; i++) {
          console.log(
            "🚀 ~ file: index.js ~ line 78 ~ adding title",
            messages[i].title
          );
          await sheet.addRow({ name: messages[i].title });
          promiseArray.push(messages[i].title);
          if (i == messages.length - 1) {
            res.send({ data: promiseArray });
          }
        }
      });
    });
  });

  app.get("/message/:id", async function (req, res) {
    // var body;
    var f = client.createMessageStream(req.params.id);
    f.once("error", function (err) {
      console.log("Fetch error: " + err);
    });
    var buffer = "";
    f.on("data", function (chunk) {
      buffer += chunk.toString("utf8");
    });
    f.once("end", async function () {
      // console.log(buffer)
      // console.log("🚀 ~ file: index.js ~ line 101 ~ buffer", buffer);
      const mailObj = await simpleParser(buffer);
      console.log(
        "🚀 ~ file: index.js ~ line 106 ~ Extracting",
        mailObj.subject
      );
      res.send(mailObj.text);
    });
  });

  app.get("/messages", function (req, res) {
    client.openMailbox("INBOX", function (error, mailbox) {
      if (error) throw error;
      client.listMessages(-mailbox.count, function (err, messages) {
        messages.forEach(function (message, index) {
          // console.log(message.UID + ": " + message.title);
          getMessageBody(client, message.UID, message.title);
        });
        // setEmit(socketio, messagesArr);
      });
    });
    res.send({});
  });

  app.get("/createRecognizer", function (req, res) {
    var params = {
      DataAccessRoleArn:
        "arn:aws:comprehend:ap-south-1:703971834267:entity-recognizer/comprehend-v1" /* required */,
      InputDataConfig: {
        /* required */
        EntityTypes: [
          /* required */
          {
            Type: "STRING_VALUE" /* required */,
          },
          /* more items */
        ],
        Annotations: {
          S3Uri: "STRING_VALUE" /* required */,
        },
        AugmentedManifests: [
          {
            AttributeNames: [
              /* required */
              "STRING_VALUE",
              /* more items */
            ],
            S3Uri: "STRING_VALUE" /* required */,
          },
          /* more items */
        ],
        DataFormat: COMPREHEND_CSV | AUGMENTED_MANIFEST,
        Documents: {
          S3Uri: "STRING_VALUE" /* required */,
        },
        EntityList: {
          S3Uri: "STRING_VALUE" /* required */,
        },
      },
      LanguageCode: en /* required */,
      RecognizerName: "MARVEL" /* required */,
      Tags: [
        {
          Key: "VESSEL" /* required */,
        },
        /* more items */
      ],
      // VpcConfig: {
      //   SecurityGroupIds: [
      //     /* required */
      //     "STRING_VALUE",
      //     /* more items */
      //   ],
      //   Subnets: [
      //     /* required */
      //     "STRING_VALUE",
      //     /* more items */
      //   ],
      // },
    };
    comprehend.createEntityRecognizer(params, function (err, data) {
      if (err) console.log(err, err.stack);
      // an error occurred
      else console.log(data); // successful response
    });
    res.send({});
  });
};

const getMessageBody = (client, uid, title) => {
  var f = client.createMessageStream(uid);
  f.once("error", function (err) {
    console.log("Fetch error: " + err);
  });
  var buffer = "";
  f.on("data", function (chunk) {
    buffer += chunk.toString("utf8");
  });
  f.once("end", async function () {
    // console.log(buffer)
    // console.log("🚀 ~ file: index.js ~ line 101 ~ buffer", buffer);
    const mailObj = await simpleParser(buffer);
    const content =
      "==TITLE===========================\n" +
      title +
      "\n==BODY==========================\n" +
      mailObj.text.replace(/^\s*[\r\n]/gm, "") +
      "\n";
    console.log("🚀 ~ Extraction Body ~ Started");
    console.log(title);
    fs.writeFile("MailBody.csv", content, { flag: "a+" }, (err) => {});
    console.log("🚀 End");

    // res.send(mailObj.text);
  });
};

const setResponse = (socket, body, res) => {
  var params = {
    LanguageCode: "en",
    Text: "" + body,
  };
  var parsedResponse = parseMail(params);
  console.log(parsedResponse);
  socket.emit("PARSE", parsedResponse);
  res.send({ data: parsedResponse });
};

const setEmit = (socket, response) => {
  // Emitting a new message. Will be consumed by the client
  response.reverse();
  socket.emit("INBOX", response);
};
const setEmitParsed = (socket, response) => {
  // Emitting a new message. Will be consumed by the client
  // response.reverse()
  socket.emit("PARSE", response);
};

const parseMail = (params) => {
  return comprehend.detectKeyPhrases(params, function (err, data) {
    if (err) {
      console.log(err, err.stack);
      return err;

      // res.send({ data: err })
    } // an error occurred
    else {
      console.log("dataaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", data);
      // res.send({ data: data })
      return data;
    } // successful response
  });
};
