const fs = require('fs');
const request = require('request');

module.exports.config = {
    name: "send",
    version: "1.0.0",
    hasPermssion: 2,
    credits: "TruongMini, mod thêm by tòn",
    description: "",
    commandCategory: "Admin",
    usages: "[msg]",
    cooldowns: 5,
}

let atmDir = [];

const getAtm = (atm, body) => new Promise(async (resolve) => {
    let msg = {}, attachment = [];
    msg.body = body;
    for(let eachAtm of atm) {
        await new Promise(async (resolve) => {
            try {
                let response =  await request.get(eachAtm.url),
                    pathName = response.uri.pathname,
                    ext = pathName.substring(pathName.lastIndexOf(".") + 1),
                    path = __dirname + `/cache/${eachAtm.filename}.${ext}`
                response
                    .pipe(fs.createWriteStream(path))
                    .on("close", () => {
                        attachment.push(fs.createReadStream(path));
                        atmDir.push(path);
                        resolve();
                    })
            } catch(e) { console.log(e); }
        })
    }
    msg.attachment = attachment;
    resolve(msg);
})

module.exports.handleReply = async function ({ api, event, handleReply, Users, Threads }) {
    const moment = require("moment-timezone");
      var gio = moment.tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY - HH:mm:s");
    const { threadID, messageID, senderID, body } = event;
    let name = await Users.getNameUser(senderID);
    switch (handleReply.type) {
        case "sendnoti": {
            let text = `[ Phản Hồi Từ User ]\n──────────────────\n🙍‍♂️ Name: ${name}\n🏘️ Từ Nhóm: ${(await Threads.getInfo(threadID)).threadName || "Unknow"}\n📝 Nội dung: ${body}\n\n📌 Reply tin nhắn này để phản hồi`;
            if(event.attachments.length > 0) text = await getAtm(event.attachments, `[ Phản Hồi Từ User ]\n──────────────────\n👤 Name: ${name}\n🏘️ Từ Nhóm: ${(await Threads.getInfo(threadID)).threadName || "Unknow"}\n📝 Nội dung: ${body}\n\n📌 Reply tin nhắn này để phản hồi` );
            api.sendMessage(text, handleReply.threadID, (err, info) => {
                atmDir.forEach(each => fs.unlinkSync(each))
                atmDir = [];
                global.client.handleReply.push({
                    name: this.config.name,
                    type: "reply",
                    messageID: info.messageID,
                    messID: messageID,
                    threadID
                })
            });
            break;
        }
        case "reply": {
            let text = `[ Phản Hồi Từ Admin ]\n──────────────────\n🙍‍♂️ Admin: ${name}\n📝 Nội dung: ${body}\n\n📌 Reply tin nhắn này để phản hồi`;
            if(event.attachments.length > 0) text = await getAtm(event.attachments, `[ Phản Hồi Từ Admin ]\n──────────────────\n🙍‍♂️ Admin: ${name}\n📝 Nội dung: ${body}\n\n📌 Reply tin nhắn này để phản hồi`);
            api.sendMessage(text, handleReply.threadID, (err, info) => {
                atmDir.forEach(each => fs.unlinkSync(each))
                atmDir = [];
                global.client.handleReply.push({
                    name: this.config.name,
                    type: "sendnoti",
                    messageID: info.messageID,
                    threadID
                })
            }, handleReply.messID);
            break;
        }
    }
}

module.exports.run = async function ({ api, event, args, Users }) {
    const moment = require("moment-timezone");
      var gio = moment.tz("Asia/Ho_Chi_Minh").format("DD/MM/YYYY - HH:mm:s");
    const { threadID, messageID, senderID, messageReply } = event;
    if (!args[0]) return api.sendMessage("Please input message", threadID);
    let allThread = global.data.allThreadID || [];
    let can = 0, canNot = 0;
    let text = `[ Thông Báo Từ Admin ]\n──────────────────\n🙎‍♂️ Admin: ${await Users.getNameUser(senderID)}\n📝 Nội dung: ${args.join(" ")}\n\n📌 Reply tin nhắn này để phản hồi`;
    if(event.type == "message_reply") text = await getAtm(messageReply.attachments, `[ Thông Báo Từ Admin ]\n──────────────────\n🙎‍♂️ Admin: ${await Users.getNameUser(senderID)}\n📝 Nội dung: ${args.join(" ")}\n\n📌 Reply tin nhắn này để phản hồi`                              );
    await new Promise(resolve => {
        allThread.forEach((each) => {
            try {
                api.sendMessage(text, each, (err, info) => {
                    if(err) { canNot++; }
                    else {
                        can++;
                        atmDir.forEach(each => fs.unlinkSync(each))
                        atmDir = [];
                        global.client.handleReply.push({
                            name: this.config.name,
                            type: "sendnoti",
                            messageID: info.messageID,
                            messID: messageID,
                            threadID
                        })
                        resolve();
                    }
                })
            } catch(e) { console.log(e) }
        })
    })
    api.sendMessage(`✅ Gửi thông báo thành công đến ${can} nhóm, ⚠️ Không thể gửi thông báo đến ${canNot} nhóm`, threadID);
  }