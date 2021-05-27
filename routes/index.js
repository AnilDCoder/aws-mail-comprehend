var inbox = require("inbox");
var AWS = require('aws-sdk');
const simpleParser = require('mailparser').simpleParser;

var comprehend = new AWS.Comprehend({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});
module.exports = function (app, io) {
  var socketio = io;

  let messagesArr = []
  setEmit(socketio, messagesArr)
  var client = inbox.createConnection(process.env.IMAP_PORT, process.env.IMAP_HOST, {
    secureConnection: true,
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
    }
  });

  client.connect();

  client.on("connect", function () {
    console.log("Successfully connected to imap");
    client.openMailbox("INBOX", function (error, mailbox) {
      if (error) throw error;
      client.listMessages(-10, function (err, messages) {
        messages.forEach(function (message) {
          console.log(message.UID + ": " + message.title);
          messagesArr.push(message)
        });
        setEmit(socketio, messagesArr)
      });
    });
    client.on("new", function (message) {
      console.log("New incoming message " + message.title);
      messagesArr.push(message)
      // var params = {
      //   LanguageCode: 'en',
      //   Text: message
      // };
      // var parsedResponse = parseMail(params)
      // setEmitParsed(socketio, parsedResponse)

      setEmit(socketio, messagesArr)
    });
  });

  app.get('/reset', function (req, res) {
    var socketio = req.app.get('socketio');
    setEmit(socketio, [])
  })

  app.get('/message/:id', function (req, res) {
    var f = client.createMessageStream(req.params.id);
    f.once('error', function (err) {
      console.log('Fetch error: ' + err);
    });
    var buffer = '';
    f.on('data', function (chunk) {
      buffer += chunk.toString('utf8');
    });
    f.once('end', function () {

      simpleParser(buffer).then(function (mailObj) {
        console.log(mailObj.text)
        // var params = {
        //   LanguageCode: 'en',
        //   Text: '' + mailObj.text
        // };
        // var parsedResponse = parseMail(params)
        // console.log(parsedResponse)
        // socket.emit("PARSE", parsedResponse);
        res.send({ data: mailObj.text })

      });

    });
  })
}

const setResponse = (socket, body, res) => {
  var params = {
    LanguageCode: 'en',
    Text: '' + body
  };
  var parsedResponse = parseMail(params)
  console.log(parsedResponse)
  socket.emit("PARSE", parsedResponse);
  res.send({ data: parsedResponse })

}

const setEmit = (socket, response) => {
  // Emitting a new message. Will be consumed by the client
  response.reverse()
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
      return err

      // res.send({ data: err })
    } // an error occurred
    else {
      console.log('dataaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', data);
      // res.send({ data: data })
      return data

    }         // successful response
  });
}