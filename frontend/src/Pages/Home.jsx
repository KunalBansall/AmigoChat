import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// const API_URL = "http://localhost:5000"; 
const API_URL = "https://auth-app-main-4bam.onrender.com" ;

const Home = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredUser, setFilteredUsers] = useState([]);
  const { user : CurrentUser } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users`);
        setUsers(response.data);
        setFilteredUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const filtered = users
      .filter((u) => u._id !== CurrentUser?._id)
      .filter((u) =>
        u.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );

    setFilteredUsers(filtered);
  }, [searchQuery, users, CurrentUser]);

  return (
    <div className="home-page p-9 ">
      <div className="search-bar mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users"
          className="w-full px-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        />
      </div>

      {/* User List */}
      <ul className="space-y-4">
        {filteredUser.map((user) => (
          <li key={user._id} className="flex items-center border p-4 rounded">
            <img
              src={
                user.avatar ||
                "https://cdn1.iconfinder.com/data/icons/user-pictures/101/malecostume-512.png"
              }
              alt={user.username}
              className="w-12 h-12 rounded-full mr-4"
            />
            <Link to={`/chat/${user._id}`} className="text-lg">
              {user.username}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Home;
