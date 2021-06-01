var inbox = require("inbox");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const doc = new GoogleSpreadsheet(
  "1LLTd_mZXTUoSG_eRth_b3daRi5SNThfm6ZZfhGDQ06g"
);

const creds = require("../google_client.json");

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
    client.on("new", function (message) {
      console.log("New incoming message " + message.title);
      messagesArr.push(message);
      setEmit(socketio, messagesArr);
    });
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
};

const setEmit = (socket, response) => {
  // Emitting a new message. Will be consumed by the client
  response.reverse();
  socket.emit("INBOX", response);
};
