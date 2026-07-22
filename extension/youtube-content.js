chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "GET_YOUTUBE_VIDEO_STATE") return false;

  const video = document.querySelector("video");
  sendResponse({
    ok: Boolean(video),
    video: {
      url: location.href,
      title: document.title.replace(/ - YouTube$/, ""),
      currentTime: video ? Math.round(video.currentTime) : 0
    }
  });

  return false;
});
