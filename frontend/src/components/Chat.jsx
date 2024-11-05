import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  ref,
  getDownloadURL,
  getStorage,
  uploadBytesResumable,
} from "firebase/storage";
import { getFirestore, collection, getDocs } from "firebase/firestore"; // Firebase Firestore
import { FaPaperclip, FaTimesCircle } from "react-icons/fa"; // Add FontAwesome icons
import { getAuth,onAuthStateChanged } from "firebase/auth";

// const API_URL = "https://auth-app-main-4bam.onrender.com";
const API_URL = "http://localhost:5000";
const socket = io(`${API_URL}`, {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const getChatroomId = (userId1, userId2) => {
  return [userId1, userId2].sort().join("-");
};

const Chat = () => {
  const { userId } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const chatWindowRef = useRef(null);
  const [media, setMedia] = useState([]); // storing media
  const [uploading, setUploading] = useState(false);
  const storage = getStorage();
  const [filePerc, setFilePerc] = useState(0);
  const getFileExtension = (filename) => {
    if (!filename) return "";
    return filename.split(".").pop().split(/\#|\?/)[0];
  };

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User is authenticated", user);
      } else {
        console.log("User is not authenticated");
      }
    });
  }, []); 
  useEffect(() => {
    const fetchMessages = async () => {
      const querySnapshot = await getDocs(
        collection(getFirestore(), "messages")
      );
      let msgs = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().chatroomId === chatroomId) {
          msgs.push(doc.data());
        }
      });
      setMessages(msgs);
    };
    fetchMessages();
  }, []);
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setMedia((prevMedia) => [...prevMedia, ...files].slice(0, 8));
    }
    if (files.length + media.length > 8) {
      alert("You can only upload up to 8 files.");
      return;
    }
  };
  const removeMedia = (indextoRemove) => {
    setMedia((prevMedia) =>
      prevMedia.filter((_, index) => index !== indextoRemove)
    );
  };

  const uploadMedia = async (file) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUploading(true);
      const filename = new Date().getTime() + "_" + file.name;
      const storageRef = ref(storage, `chat-media/${filename}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setFilePerc(Math.round(progress));
          },
          (error) => reject(error),
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              setUploading(false);
              resolve(url);
            } catch (err) {
              reject(err);
              setUploading(false);
            }
          }
        );
      });
    } else {
      console.error("User not authenticated");
      setUploading(false);
      return null;
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user || !user._id) {
      return;
    }

    const chatroomId = getChatroomId(user._id, userId); // Generating chatroom

    const fetchChatUser = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users/${userId}`);
        setChatUser(response.data);
      } catch (error) {
        console.error("Error fetching Chat User details", error);
      }
    };

    if (isAuthenticated) {
      fetchChatUser();

      socket.emit("joinChat", { userId: user._id, chatroomId }); // Use generated chatroomId

      socket.on("receiveMessage", (msg) => {
        // Update chat history for both sender and recipient
        if (msg.recipient === user._id || msg.sender === user._id) {
          setChatHistory((prev) => [...prev, msg]);
        }
      });
      socket.on("chatHistory", (history) => {
        setChatHistory(history);
      });
    }

    return () => {
      socket.off("receiveMessage");
      socket.off("chatHistory");
    };
  }, [isAuthenticated, userId, user]);

  const sendMessage = async () => {
    if (!user || !userId) return;
    if (!message.trim() && !media.length) return;

    const chatroomId = getChatroomId(user._id, userId); // Generate chatroom ID
    let mediaUrls = [];
    if (media.length) {
      try {
        mediaUrls = await Promise.all(media.map(uploadMedia));
        // console.log("media url", mediaUrls);
      } catch (error) {
        console.error("Error uploading media Files", error);
      }
    }
    const msg = {
      chatroomId,
      sender: user._id,
      recipient: userId,
      text: message.trim() || "",
      mediaUrls,
      createdAt: new Date(),
    };

    socket.emit("sendMessage", msg, (ack) => {
      if (ack.status === "success") {
        setMessage("");
        setMedia([]);
      } else {
        console.error("Message sending failed");
      }
    });
    setMessage(""); // Clear the message input
  };

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight; // Scroll to the bottom of the chat window
    }
  }, [chatHistory]);

  if (!isAuthenticated || !user || !user._id) {
    return <div>Loading...</div>; // Display loading when not authenticated
  }

  return (
    <div className="flex flex-col h-screen bg-yellow-200 p-4">
      <div className="text-gray-700 mb-4 sticky top-0 z-10 bg-purple-700 p-2">
        {chatUser ? `Chatting with: ${chatUser.username}` : "Loading..."}
      </div>
      <div
        ref={chatWindowRef}
        className="chat-window flex flex-col overflow-y-auto h-full bg-gray-100 rounded-lg p-4 space-y-2 shadow-lg"
        style={{ maxHeight: "calc(100vh - 120px)" }}
      >
        {chatHistory.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start ${
              msg.sender === user._id ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender !== user._id && (
              <img
                src={chatUser?.avatar}
                alt="user avatar"
                className="w-8 h-8 rounded-full mr-2"
              />
            )}
            <div
              className={`p-1 rounded-lg max-w-[80%] sm:max-w-[70%] md:max-w-[60%] lg:max-w-[50%] xl:max-w-[40%] ${
                msg.sender === user._id
                  ? "bg-blue-900 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              <p className="text-sm">
                <span className="font-semibold">
                  {msg.sender === user._id ? "You" : chatUser?.username}
                </span>
                : {msg.text}
              </p>

              {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                <div className="mt-2">
                  {msg.mediaUrls.map((url, index) => {
                    const fileExt = getFileExtension(url);
                    return (
                      <div key={index}>
                        {["jpg", "jpeg", "png", "webp"].includes(fileExt) ? (
                          <img
                            src={url}
                            alt="Media"
                            className="w-full rounded-lg"
                          />
                        ) : ["mp4", "mov"].includes(fileExt) ? (
                          <video
                            controls
                            muted
                            className="max-w-full rounded-lg"
                          >
                            <source src={url} type={"video/mp4"} />
                            Your browser does not support the video tag.
                          </video>
                        ) : (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="text-orange-400"> View Media</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <span
                className="text-xs text-gray-500"
                style={{ fontSize: "0.7rem", marginTop: "4px" }}
              >
                {new Date(msg.createdAt).toLocaleString("en-US", {
                  hour: "numeric",
                  minute: "numeric",
                  hour12: true,
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
      {media.length > 0 && (
        <div className="media-preview grid grid-cols-4 gap-2 my-2">
          {media.map((file, index) => (
            <div key={index} className="relative group">
              <img
                src={URL.createObjectURL(file)}
                alt={`media-${index}`}
                className="w-full h-24 object-cover rounded-md"
              />
              <button
                onClick={() => removeMedia(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
              >
                <FaTimesCircle />
              </button>
            </div>
          ))}
        </div>
      )}
      {uploading && (
        <div className="absolute top-0 left-0 right-0 bottom-0 bg-opacity-50 bg-gray-700 flex justify-center items-center text-white z-10">
          Sending...{filePerc}%
        </div>
      )}

      <div className="flex items-center mt-4 justify-center">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()} // Send message on Enter key
          placeholder="Type a message"
          className="flex-grow p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer p-2 bg-gray-200 rounded-full ml-2"
          title="attach a file"
        >
          <FaPaperclip size={20} className="text-gray-600" />
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
          multiple
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white p-3 rounded-r-lg ml-2"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
