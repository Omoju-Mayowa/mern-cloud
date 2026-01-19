import React, { useState, useEffect, useContext } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { FaEdit } from 'react-icons/fa'
import { UserContext } from './components/context/userContext'
import PostItem from './components/PostItem'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'

const UserProfile = () => {
  const { id } = useParams()
  const { currentUser } = useContext(UserContext)
  const [userData, setUserData] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)

  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  // Smart URL Resolver for both Avatars and Post Thumbnails
  const resolveUrl = (path, type = 'post') => {
    if (!path || path.includes('default')) {
      return type === 'avatar' ? `${assetsBase}/mern/default-avatar.png` : `${assetsBase}/mern/post-placeholder.jpg`;
    }
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('mern/') ? path : `mern/${path}`;
    return `${assetsBase}/${cleanPath}`;
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`);
        const postsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${id}`);
        setUserData(userRes.data);
        setPosts(postsRes.data);
        setFormData({ name: userRes.data.name, email: userRes.data.email, currentPassword: '', newPassword: '', confirmNewPassword: '' });
        setAvatarPreview(resolveUrl(userRes.data.avatar, 'avatar'));
      } catch (err) { setError('Profile not found') } finally { setLoading(false) }
    }
    fetchProfile();
  }, [id]);

  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(id)) {
      setUserData(payload);
      setAvatarPreview(resolveUrl(payload.avatar, 'avatar'));
    }
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append('name', formData.name);
    data.append('email', formData.email);
    if (avatarFile) data.append('avatar', avatarFile);

    try {
      const res = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`, data, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      setUserData(res.data);
      setIsEditing(false);
    } catch (err) { setError(err.response?.data?.message || "Update failed") }
  }

  if (loading) return <Loader />

  return (
    <section className="profile">
      <div className="container profile__container">
        <div className="profile__details">
          <div className="avatar__wrapper">
            <div className="profile__avatar">
              <img src={avatarPreview} alt="User Avatar" />
            </div>
            {isEditing && (
              <form className="avatar__form">
                <input type="file" id="avatar" accept='image/*' onChange={e => {
                  setAvatarFile(e.target.files[0]);
                  setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                }} />
                <label htmlFor="avatar"><FaEdit /></label>
              </form>
            )}
          </div>

          <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>{userData?.name}</h1>

          <form className="form profile__form" onSubmit={handleUpdate}>
            {error && <p className="form__error-message">{error}</p>}
            <input type="text" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={!isEditing} />
            <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!isEditing} />
            {isEditing && <button type="submit" className="btn primary">Update Profile</button>}
          </form>

          {!isEditing && currentUser?.id === id && (
            <div className="center" style={{ marginTop: '1rem' }}>
              <button className="btn primary" onClick={() => setIsEditing(true)}>Edit Profile</button>
            </div>
          )}
        </div>

        <div className="profile__posts" style={{ marginTop: '4rem' }}>
          <h2 className="center">Posts by {userData?.name}</h2>
          <div className="container posts__container">
            {posts.map(post => (
              <PostItem 
                key={post._id} 
                postID={post._id} 
                {...post} 
                // Ensure PostItem internal resolver works or pass resolved paths
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default UserProfile;
