import React, { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from './components/axios' // Import our custom instance
import { UserContext } from './components/context/userContext'
// ... icons and components

const UserProfile = () => {
  const { id } = useParams()
  const { currentUser } = useContext(UserContext)
  const [userData, setUserData] = useState(null)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmNewPassword: '' })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userRes = await axios.get(`/users/${id}`);
        setUserData(userRes.data);
        setFormData(prev => ({ ...prev, name: userRes.data.name, email: userRes.data.email }));
      } catch (err) { setError('Profile not found') }
    }
    fetchProfile();
  }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    const token = currentUser?.token;

    try {
      // Update Password
      if (formData.newPassword) {
        await axios.patch(`/users/edit-user`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Update Profile
      const data = new FormData();
      data.append('name', formData.name);
      data.append('email', formData.email);
      const res = await axios.patch(`/users/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUserData(res.data);
      setIsEditing(false);
      alert("Profile Updated Successfully");
    } catch (err) { 
      setError(err.response?.data?.message || "Update failed"); 
    }
  }

  // ... rest of your JSX template
}

export default UserProfile;
