import express from "express";

const messageRouter = express.Router();
const messageContainer = document.getElementById("input");
const message = messageContainer.innerHTML;
messageRouter.get("/send", (req, res) => {
  res.json({
    data: {
      message: message,
    },
  });
});
export default messageRouter;
