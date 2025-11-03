const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "edit",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "MOHAMMAD AKASH (converted for Mirai by ChatGPT)",
  description: "Edit or generate an image using AI prompt",
  commandCategory: "AI",
  usages: "[prompt] (reply to an image)",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event, args }) {
  const prompt = args.join(" ");
  const reply = event.messageReply;

  if (!prompt || !reply || !reply.attachments || reply.attachments[0].type !== "photo") {
    return api.sendMessage("⚠️ | Please reply to a photo with your prompt to edit it.", event.threadID, event.messageID);
  }

  const imageUrl = reply.attachments[0].url;
  const imgPath = path.join(__dirname, "cache", `${Date.now()}_edit.jpg`);

  api.setMessageReaction("🛠️", event.messageID, () => {}, true);

  const apis = [
    `https://edit-and-gen.onrender.com/gen?prompt=${encodeURIComponent(prompt)}&image=${encodeURIComponent(imageUrl)}`,
    `http://65.109.80.126:20409/aryan/editv2?prompt=${encodeURIComponent(prompt)}&imgurl=${encodeURIComponent(imageUrl)}`
  ];

  let success = false;

  for (const apiUrl of apis) {
    try {
      const isBase64 = apiUrl.includes("65.109.80.126");
      const response = await axios.get(apiUrl, { responseType: isBase64 ? "json" : "arraybuffer" });

      if (isBase64 && response.data?.image_data) {
        const imageBuffer = Buffer.from(response.data.image_data.replace(/^data:image\/\w+;base64,/, ""), "base64");
        await fs.ensureDir(path.dirname(imgPath));
        await fs.writeFile(imgPath, imageBuffer);
        success = true;
        break;
      }

      if (!isBase64 && response.data) {
        await fs.ensureDir(path.dirname(imgPath));
        await fs.writeFile(imgPath, Buffer.from(response.data, "binary"));
        success = true;
        break;
      }

    } catch (err) {
      console.log(`⚠️ | ${apiUrl} failed: ${err.message}`);
    }
  }

  if (success) {
    api.sendMessage(
      {
        body: `✅ | Edited image for: "${prompt}"`,
        attachment: fs.createReadStream(imgPath),
      },
      event.threadID,
      () => {
        fs.unlinkSync(imgPath);
        api.setMessageReaction("✅", event.messageID, () => {}, true);
      },
      event.messageID
    );
  } else {
    api.sendMessage("❌ | Failed to edit image using all available APIs.", event.threadID, event.messageID);
    api.setMessageReaction("❌", event.messageID, () => {}, true);
  }
};
