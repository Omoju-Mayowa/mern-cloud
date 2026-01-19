import React, { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FaEdit } from 'react-icons/fa'
import { UserContext } from './components/context/userContext'
import PostItem from './components/PostItem'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'

const UserProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  const [userData, setUserData] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // UI States
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  // Form Data
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    currentPassword: '', 
    newPassword: '', 
    confirmNewPassword: '' 
  })
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)

  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

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
        setFormData(prev => ({ 
          ...prev, 
          name: userRes.data.name, 
          email: userRes.data.email 
        }));
        setAvatarPreview(resolveUrl(userRes.data.avatar, 'avatar'));
      } catch (err) { 
        setError('Profile not found') 
      } finally { 
        setLoading(false) 
      }
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
    setError('');
    const token = currentUser?.token;

    try {
      // 1. Handle Password Change (if fields are filled)
      if (isChangingPassword && formData.newPassword) {
        if (formData.newPassword !== formData.confirmNewPassword) {
          return setError("New passwords do not match");
        }
        await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/edit-user`, {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          confirmNewPassword: formData.confirmNewPassword,
          name: formData.name, 
          email: formData.email
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // 2. Handle Profile Data (Avatar/Name/Email)
      const data = new FormData();
      data.append('name', formData.name);
      data.append('email', formData.email);
      if (avatarFile) data.append('avatar', avatarFile);

      const res = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`, data, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });

      setUserData(res.data);
      setIsEditing(false);
      setIsChangingPassword(false);
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmNewPassword: '' }));
      alert("Profile Updated Successfully");
    } catch (err) { 
      setError(err.response?.data?.message || "Update failed"); 
    }
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

            {isEditing && (
              <>
                <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <p 
                    onClick={() => setIsChangingPassword(!isChangingPassword)} 
                    style={{ cursor: 'pointer', color: 'var(--color-primary)', display: 'inline-block' }}
                  >
                    {isChangingPassword ? "Cancel Password Change" : "Change Password?"}
                  </p>
                </div>

                {isChangingPassword && (
                  <div className="password-fields" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input type="password" placeholder="Current Password" value={formData.currentPassword} onChange={e => setFormData({...formData, currentPassword: e.target.value})} />
                    <input type="password" placeholder="New Password" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} />
                    <input type="password" placeholder="Confirm New Password" value={formData.confirmNewPassword} onChange={e => setFormData({...formData, confirmNewPassword: e.target.value})} />
                  </div>
                )}
                
                <button type="submit" className="btn primary" style={{ marginTop: '1.5rem' }}>Update Profile</button>
              </>
            )}
          </form>

          {!isEditing && currentUser?.id === id && (
            <div className="center" style={{ marginTop: '1.5rem' }}>
              <button className="btn primary" onClick={() => setIsEditing(true)}><FaEdit/> Edit Profile</button>
            </div>
          )}
        </div>

        <div className="profile__posts" style={{ marginTop: '4rem' }}>
          <h2 className="center">Posts by {userData?.name}</h2>
          <div className="container posts__container">
            {posts.length > 0 ? posts.map(post => (
              <PostItem key={post._id} postID={post._id} {...post} />
            )) : <h4 className='center'>No posts found.</h4>}
          </div>
        </div>
      </div>
    </section>
  )
}

export default UserProfile;
