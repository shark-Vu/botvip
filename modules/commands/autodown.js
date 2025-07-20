module.exports.config = {
  name: "autodown",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "Panna", // Hoàng Quyết
  description: "Tự động tải video từ link",
  commandCategory: "tiện ích",
  usages: "[on/off]",
  cooldowns: 5,
  envConfig: {
      status: true
  }
};
const API_ENDPOINT = "https://subhatde.id.vn";
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

function urlify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = [];
  let match;  
  while ((match = urlRegex.exec(text)) !== null) {
      urls.push(match[1]);
  } 
  return urls;
}
async function getStreamFromURL(url, type) {
  const response = await axios({
      method: "GET",
      url,
      responseType: "arraybuffer"
  });

  const ext = type === "mp3" ? "mp3" : "mp4"; 
  const filePath = __dirname + `/cache/file.${ext}`;

  fs.writeFileSync(filePath, Buffer.from(response.data, "utf-8"));
  setTimeout(() => fs.unlinkSync(filePath), 60000); 

  return fs.createReadStream(filePath);
}
function getThreadStatus() {
  const statusFile = path.join(__dirname, "cache", "autodown.json");
  if (!fs.existsSync(statusFile)) {
      fs.writeFileSync(statusFile, JSON.stringify({}, null, 2));
      return {};
  }
  return JSON.parse(fs.readFileSync(statusFile, "utf8"));
}
function saveThreadStatus(threadStatus) {
  const statusFile = path.join(__dirname, "cache", "autodown.json");
  fs.writeFileSync(statusFile, JSON.stringify(threadStatus, null, 2));
}
module.exports.handleEvent = async function ({ api, event, client }) {
  const { threadID } = event;
  const threadStatus = getThreadStatus();
  if (threadStatus[threadID] === undefined) {
      threadStatus[threadID] = this.config.envConfig.status;
      saveThreadStatus(threadStatus);
  }
  if (!threadStatus[threadID]) return;    
  if (event.senderID == (global.botID || api.getCurrentUserID())) return;
  const urls = urlify(event.body); 
  for (const url of urls) {
      try {
          if (/^https?:\/\/(?:vm\.|vt\.|v\.|www\.)?(?:tiktok)\.com\//.test(url)) {
              const { data } = await axios.post(`https://www.tikwm.com/api/`, {
                  url: url 
              });

              if (data.data) {
                  const tiktokData = data.data;
                  const msg = {
                      body: `[ AUTODOWN TIKTOK ]\n──────────────────\n📺 Kênh: ${tiktokData.author.nickname}\n📎 URL: https://www.tiktok.com/@${tiktokData.author.unique_id}\n📍 Tiêu Đề: ${tiktokData.title}\n⛳ Quốc Gia: ${tiktokData.region}\n⏱️ Thời Lượng: ${tiktokData.music_info.duration}\n👍 Lượt Thích: ${tiktokData.digg_count}\n💬 Lượt Bình Luận: ${tiktokData.comment_count}\n🔀 Lượt Chia Sẻ: ${tiktokData.share_count}\n⬇️ Lượt Tải: ${tiktokData.download_count}\n🎧 Nhạc Gốc: ${tiktokData.music_info.album}\n📌 Thả cảm xúc để tải nhạc or nhạc gốc`,
                      attachment: []
                  };
                  if (tiktokData.images) {
                      msg.attachment = await Promise.all(
                          tiktokData.images.map(img => getStreamFromURL(img, 'jpg'))
                      );
                  } else {
                      msg.attachment = [await getStreamFromURL(tiktokData.play, 'mp4')];
                  }

                  const sent = await api.sendMessage(msg, event.threadID);
                  global.client.handleReaction.push({
                      name: this.config.name,
                      messageID: sent.messageID,
                      url_audio: tiktokData.music,
                      author: event.senderID 
                  });
              }
          } else if (/(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/(?:share\/)?(?:v\/|p\/)?[a-zA-Z0-9.]+|fb\.watch/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/fb/download?url=${encodeURIComponent(url)}`);
              const data = response.data;
              if (data.medias && data.medias.length > 0) {
                  const videos = data.medias.filter(media => media.type === "video");
                  const images = data.medias.filter(media => media.type === "image");             
                  let msg = {
                      body: `[ AUTODOWN - FACEBOOK ]\n────────────────\n⩺ Tiêu đề: ${data.title || ""}`,
                      attachment: []
                  };
                  if (videos.length > 0) {
                      const hdVideo = videos.find(video => video.quality === "HD") || videos[0];
                      msg.body += `\n⩺ Thời lượng: ${Math.floor(data.duration/1000)} giây\n⩺ Chất lượng: ${videos.map(v => v.quality).join(", ")}`;
                      msg.attachment = [await getStreamFromURL(hdVideo.url, "mp4")];
                  } else if (images.length > 0) {
                      msg.body += `\n⩺ Số lượng ảnh: ${images.length}`;
                      msg.attachment = await Promise.all(
                          images.map(img => getStreamFromURL(img.url, "jpg"))
                      );
                  }
                  await api.sendMessage(msg, event.threadID);
              }
          } else if (/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel)\/([^\/?#&]+)/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/instagram/download?link=${encodeURIComponent(url)}`);
              const data = response.data;               
              if (data && data.attachments) {
                  let msg = {
                      body: `[ AUTODOWN - INSTAGRAM ]\n────────────────\n⩺ Tiêu đề: ${data.caption || ""}\n⩺ Tác giả: ${data.owner.full_name} (${data.owner.username})\n⩺ Lượt thích: ${data.like_count}\n⩺ Bình luận: ${data.comment_count}`,
                      attachment: []
                  };
                  if (data.media_type === 2) {
                      const videoAttachment = data.attachments.find(att => att.type === "Video");
                      if (videoAttachment) {
                          msg.attachment = [await getStreamFromURL(videoAttachment.url, "mp4")];
                      }
                  } else {
                      const photoAttachments = data.attachments.filter(att => att.type === "Photo");
                      if (photoAttachments.length > 0) {
                          msg.body += `\n⩺ Số lượng ảnh: ${photoAttachments.length}`;
                          msg.attachment = await Promise.all(
                              photoAttachments.map(att => getStreamFromURL(att.url, "jpg"))
                          );
                      }
                  }
                  await api.sendMessage(msg, event.threadID);
              }
          } else if (/(?:https?:\/\/)?(?:(?:www\.|on\.)?soundcloud\.com\/[^\/]+\/[^\/]+|on\.soundcloud\.com\/[a-zA-Z0-9]+)/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/scl/download?url=${encodeURIComponent(url)}`);
              const data = response.data;            
              if (data && data.attachments) {
                  let msg = {
                      body: `[ AUTODOWN - SOUNDCLOUD ]\n────────────────\n⩺ Tiêu đề: ${data.title || ""}\n⩺ Tác giả: ${data.author || ""}\n⩺ Lượt phát: ${data.playback}\n⩺ Lượt thích: ${data.likes}\n⩺ Bình luận: ${data.comment}\n⩺ Chia sẻ: ${data.share}\n⩺ Thời lượng: ${data.duration}\n⩺ Đăng lúc: ${data.create_at}`,
                      attachment: []
                  };
                  const audioAttachment = data.attachments.find(att => att.type === "Audio");
                  if (audioAttachment && audioAttachment.url) {
                      msg.attachment = [await getStreamFromURL(audioAttachment.url, "mp3")];
                      await api.sendMessage(msg, event.threadID);
                  }
              }
          } else if (/(?:https?:\/\/)?(?:www\.)?capcut\.com\/t\/([a-zA-Z0-9]+)/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/capcut/download?url=${encodeURIComponent(url)}`);
              const data = response.data;            
              if (data && data.video_url) {
                  const duration = Math.floor(data.duration / 1000);
                  const minutes = Math.floor(duration / 60);
                  const seconds = duration % 60;                    
                  let msg = {
                      body: `[ AUTODOWN - CAPCUT ]\n────────────────\n⩺ Tiêu đề: ${data.title || ""}\n⩺ Tên mẫu: ${data.short_title}\n⩺ Tác giả: ${data.author.name} (${data.author.unique_id})\n⩺ Thời lượng: ${minutes}:${seconds.toString().padStart(2, '0')}\n⩺ Số đoạn: ${data.fragment_count}\n⩺ Lượt sử dụng: ${data.usage_amount}\n⩺ Lượt xem: ${data.play_amount}\n⩺ Lượt thích: ${data.like_count}\n⩺ Bình luận: ${data.comment_count}`,
                      attachment: []
                  };
                  msg.attachment = [await getStreamFromURL(data.video_url, "mp4")];
                  await api.sendMessage(msg, event.threadID);
              }
          } else if (/(?:https?:\/\/)?(?:www\.)?threads\.net\/(?:@[^\/]+\/)?(?:post\/)?([^\/?]+)/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/threads/download?url=${encodeURIComponent(url)}`);
              const data = response.data;            
              if (data && data.attachments && data.attachments.length > 0) {
                  let msg = {
                      body: `[ AUTODOWN - THREADS ]\n────────────────\n⩺ Nội dung: ${data.caption || ""}\n⩺ Tác giả: ${data.author || ""}`,
                      attachment: []
                  };
                  const mediaStreams = await Promise.all(
                      data.attachments.map(att => {
                          const fileType = att.type.toLowerCase() === "video" ? "mp4" : "jpg";
                          return getStreamFromURL(att.url, fileType);
                      })
                  );
                  msg.attachment = mediaStreams;
                  await api.sendMessage(msg, event.threadID);
              }
          } else if (/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/youtube/download?url=${encodeURIComponent(url)}`);
              const data = response.data;            
              if (data && data.videoUrl) {
                  let msg = {
                      body: `[ AUTODOWN - YOUTUBE ]\n────────────────\n⩺ Tiêu đề: ${data.title || ""}\n⩺ Tác giả: ${data.author || ""}\n⩺ Thời lượng: ${data.duration}\n⩺ ID: ${data.id}`,
                      attachment: []
                  };                
                  msg.attachment = [await getStreamFromURL(data.videoUrl, "mp4")];
                  await api.sendMessage(msg, event.threadID);
              }
          } else if (/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[^\/]+\/status\/\d+/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/tw/download?url=${encodeURIComponent(url)}`);
              const data = response.data;
              let msg = {
                  body: `[ AUTODOWN - TWITTER ]\n────────────────\n⩺ Nội dung: ${data.title || ""}\n⩺ Tác giả: ${data.author || ""} ${data.username ? `(@${data.username})` : ""}\n⩺ Thời gian: ${data.date || ""}\n⩺ Lượt thích: ${data.likes || 0}\n⩺ Bình luận: ${data.replies || 0}\n⩺ Retweet: ${data.retweets || 0}`,
                  attachment: []
              };
              const mediaStreams = await Promise.all(
                  data.media.map(async (mediaUrl) => {
                      const fileType = data.type === "video" ? "mp4" : "jpg";
                      return await getStreamFromURL(mediaUrl, fileType);
                  })
              );
              msg.attachment = mediaStreams;
              await api.sendMessage(msg, event.threadID);
          } else if (/(?:https?:\/\/)?(?:www\.)?zingmp3\.vn\/[^\/]+\/[^\/]+/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/zingmp3?link=${encodeURIComponent(url)}`);
              const data = response.data;
              let msg = {
                  body: `[ AUTODOWN - ZINGMP3 ]\n────────────────\n⩺ Bài hát: ${data.title || ""}\n⩺ Ca sĩ: ${data.artist || ""}`,
                  attachment: []
              };
              msg.attachment = [await getStreamFromURL(data.download_url, "mp3")];
              await api.sendMessage(msg, event.threadID);
          } else if (/(?:https?:\/\/)?(?:www\.)?v\.douyin\.com\/[a-zA-Z0-9]+/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/tiktok/douyindl?url=${encodeURIComponent(url)}`);
              const data = response.data;
              let msg = {
                  body: `[ AUTODOWN - DOUYIN ]\n────────────────\n⩺ ID: ${data.id || ""}\n⩺ Nội dung: ${data.caption || ""}`,
                  attachment: []
              };
              const mediaStreams = await Promise.all(
                  data.attachments.map(async (att) => {
                      const fileType = att.type.toLowerCase() === "video" ? "mp4" : "jpg";
                      return await getStreamFromURL(att.url, fileType);
                  })
              );
              msg.attachment = mediaStreams;
              await api.sendMessage(msg, event.threadID);
          } else if (/(?:https?:\/\/)?(?:(?:www\.)?xiaohongshu\.com\/explore\/[a-zA-Z0-9]+|(?:www\.)?xhslink\.com\/[a-zA-Z0-9]+)/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/fb/download?url=${encodeURIComponent(url)}`);
              const data = response.data;
              let msg = {
                  body: `[ AUTODOWN - XIAOHONGSHU ]\n────────────────\n⩺ Tiêu đề: ${data.title || ""}\n⩺ Số lượng: ${data.medias.length} ${data.medias[0].type}${data.medias.length > 1 ? "s" : ""}`,
                  attachment: []
              };
              const mediaStreams = await Promise.all(
                  data.medias.map(async (media) => {
                      if (!media || !media.url) throw new Error("URL media không hợp lệ");
                      return await getStreamFromURL(media.url, media.extension);
                  }));
              msg.attachment = mediaStreams;
              await api.sendMessage(msg, event.threadID);
          } else if (/(?:https?:\/\/)?(?:open\.)?spotify\.com\/(?:track|album)\/([a-zA-Z0-9]+)/.test(url)) {
              const response = await axios.get(`${API_ENDPOINT}/fb/download?url=${encodeURIComponent(url)}`);
              const data = response.data;              
              let msg = {
                  body: `[ AUTODOWN - SPOTIFY ]\n────────────────\n⩺ Bài hát: ${data.title || ""}\n⩺ Thời lượng: ${data.duration || ""}\n⩺ Chất lượng: ${data.medias[0].quality || ""}`,
                  attachment: []
              };
              msg.attachment = [await getStreamFromURL(data.medias[0].url, "mp3")];
              await api.sendMessage(msg, event.threadID);
          }
      } catch (error) {}
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID } = event;
  const command = args[0]?.toLowerCase();
  const threadStatus = getThreadStatus();
  if (threadStatus[threadID] === undefined) {
      threadStatus[threadID] = this.config.envConfig.status;
      saveThreadStatus(threadStatus);
  }    
  if (command === "on" || command === "off") {
      threadStatus[threadID] = command === "on";
      saveThreadStatus(threadStatus);
      return api.sendMessage(
          `✅ Đã ${command === "on" ? "bật" : "tắt"} chức năng tự động tải xuống cho nhóm này.\n` +
          `⚙️ Trạng thái hiện tại: ${command === "on" ? "Đang bật" : "Đã tắt"}`,
          threadID
      );
  }
  if (!args[0]) {
      return api.sendMessage(
          "📝 Hướng dẫn sử dụng:\n" +
          "⭐ autodown on: Bật tự động tải xuống\n" +
          "⭐ autodown off: Tắt tự động tải xuống\n" +
          `⚙️ Trạng thái hiện tại: ${threadStatus[threadID] ? "Đang bật" : "Đã tắt"}`,
          threadID
      );
  }
  try {
      await module.exports.handleEvent({ api, event });
  } catch (error) {
      api.sendMessage(`❌ Lỗi: ${error.message}`, threadID);
  }
};
module.exports.handleReaction = async function({ api, event, handleReaction }) {
  try {
      if (event.userID != handleReaction.author) return;

      const msg = {
          body: `💿 Music Downloaded 💿`,
          attachment: await getStreamFromURL(handleReaction.url_audio, 'mp3')
      };

      return api.sendMessage(msg, event.threadID, null, event.messageID);
  } catch (error) {
      return api.sendMessage(
          `❌ Error downloading music: ${error.message}`, 
          event.threadID, 
          null, 
          event.messageID
      );
  }
};