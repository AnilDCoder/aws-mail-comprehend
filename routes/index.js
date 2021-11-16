const { ImapFlow } = require('imapflow');
const simpleParser = require("mailparser").simpleParser;
const client = new ImapFlow({
  host: process.env.IMAP_HOST,
  port: process.env.IMAP_PORT,
  secure: true,
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASS,
    // user: 'anil.das@tatwa.info',
    // pass: 'Tatwa@123',
  },
  logger: false,
});

client.connect()
  .then(() => console.log('Successfully connected to GMAIL'))
  .catch(err => console.log('Error connecting GMAIL', err));

const getObjectFromTree = async (folders, arr) => {
  folders.forEach(async mailbox => {
    if (mailbox.hasOwnProperty('folders')) {
      getObjectFromTree(mailbox.folders, arr)
    } else {
      arr.push(mailbox)
    }
  });
  return arr
}

let getMailBoxes = async () => {
  let tree = await client.listTree();
  let arr = []

  let folders = await getObjectFromTree(tree.folders, arr)
  return folders
};

var setUnseenToFlag = async (arr) => {
  res = []
  for (const v of arr) {
    const status = await client.status(v.path, { unseen: true });
    v.unseen = status.unseen
    res.push(v)
  }
  return res
}

module.exports = async function (app, io) {

  app.get("/listMailBox", async function (req, res) {
    getMailBoxes().then(async (value) => {
      let result = []
      // let finalRes = await setUnseen(value)
      // console.log(finalRes)
      setUnseenToFlag(value).then(finalRes => {
        res.send({ mailboxes: finalRes })
      })
      // res.send({ mailboxes: [] })
    });
  });

  app.post("/message/:seq", async function (req, res) {
    let mailbox = await client.getMailboxLock(req.body.category);
    try {
      let { content } = await client.download(req.body.uid,'',{
        uid:true,
      });
      const mailObj = await simpleParser(content);
      res.send(mailObj);
    }
    catch (error) {
      console.log(error)
    }
    mailbox.release();
  });

  app.post("/messages", async function (req, res) {
    console.log(req.body)
    let reqBody = req.body
    // fetch UID for all messages in a mailbox

    let lock = await client.getMailboxLock(reqBody.path);
    let mailbox = await client.mailboxOpen(reqBody.path);
    let status = await client.status(reqBody.path, { unseen: true });
    console.log(mailbox)
    console.log(status)

    try {
      let messageArr = []
      // do something in the mailbox
      for await (let msg of client.fetch(`${mailbox.exists - reqBody.count}:${mailbox.exists + reqBody.count}`, {
        uid: true,
        flags: true,
        bodyStructure: true,
        envelope: true,
        internalDate: true,
        size: false,
        source: true,
        labels: false,
        headers: true,

      })) {
        msg.modseq = msg.modseq.toString()
        messageArr.push(msg)
      }
      res.send({
        messages: messageArr.reverse()
      });
    } finally {
      // use finally{} to make sure lock is released even if exception occurs
      lock.release();
    }



    // client.openMailbox(reqBody.path, function (error, mailbox) {
    //   // console.log("🚀 ~ file: index.js ~ line 211 ~ mailbox.count", mailbox.count)

    //   if (error) {
    //     res.send({
    //       error: error,
    //       messages: []
    //     });
    //   } else {
    //     if (mailbox.count != 0) {
    //       client.listMessages(mailbox.count - reqBody.count, reqBody.count, function (err, messages) {
    //         messages.forEach(function (message, index) {
    //           //   // console.log(message.UID + ": " + message.title);
    //           //   getMessageBody(client, message.UID, message.title);
    //           if (messages.length != 0) {
    //             if (index + 1 == messages.length) {
    //               let resultArr = messages.reverse()
    //               res.send({
    //                 messages: resultArr
    //               });
    //             }
    //           } else {
    //             res.send({
    //               messages: []
    //             });
    //           }
    //         });
    //       });
    //     } else {
    //       res.send({
    //         messages: []
    //       });
    //     }
    //   }
    // });
  });

};


