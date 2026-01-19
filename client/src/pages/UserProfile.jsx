import React, { useState, useEffect, useContext } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
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

  // Helper to resolve Cloudflare URLs
  const resolveAvatar = (path) => {
    if (!path || path.includes('default')) return `${assetsBase}/mern/default-avatar.png`;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('avatars/') ? `mern/${path}` : `mern/avatars/${path}`;
    return `${assetsBase}/${cleanPath}`;
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`)
        setUserData(res.data)
        setFormData(f => ({ ...f, name: res.data.name, email: res.data.email }))
        setAvatarPreview(resolveAvatar(res.data.avatar))
      } catch (err) {
        setError("Could not load user data.")
      } finally { setLoading(false) }
    }
    fetchUser()
  }, [id])

  // Real-time SSE updates
  usePostStream((event, payload) => {
    if (event === 'profile_updated' && payload._id === id) {
      setUserData(payload)
      setAvatarPreview(resolveAvatar(payload.avatar))
    }
  })

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    const token = currentUser?.token

    try {
      // 1. Handle Password Update (JSON Endpoint)
      if (isChangingPassword && formData.newPassword) {
        if (formData.newPassword !== formData.confirmNewPassword) return setError("Passwords do not match")
        await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/edit-user`, {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          confirmNewPassword: formData.confirmNewPassword
        }, { headers: { Authorization: `Bearer ${token}` } })
      }

      // 2. Handle Name/Email/Avatar (FormData Endpoint)
      const data = new FormData()
      data.append('name', formData.name)
      data.append('email', formData.email)
      if (avatarFile) data.append('avatar', avatarFile)

      const res = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`, data, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      })

      setUserData(res.data)
      setIsEditing(false)
      setIsChangingPassword(false)
      setAvatarFile(null)
      alert("Profile updated successfully")
    } catch (err) {
      setError(err.response?.data?.message || "Update failed")
    }
  }

  if (loading) return <Loader />

  return (
    <section className="profile">
      <div className="container profile__container">
        <div className="profile__details">
          <div className="avatar__wrapper">
            <div className="profile__avatar">
              <img src={avatarPreview} alt="Avatar" />
            </div>
            {isEditing && (
              <form className="avatar__form">
                <input type="file" id="avatar" accept='image/*' onChange={(e) => {
                  setAvatarFile(e.target.files[0]);
                  setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                }} />
                <label htmlFor="avatar"><FaEdit /></label>
              </form>
            )}
          </div>
          <h1>{userData?.name}</h1>
          
          <form className="form profile__form" onSubmit={handleSave}>
            {error && <p className="form__error-message">{error}</p>}
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={!isEditing} />
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!isEditing} />
            
            {isEditing && (
              <>
                <div onClick={() => setIsChangingPassword(!isChangingPassword)} style={{cursor:'pointer', color:'blue', margin:'10px 0'}}>
                  {isChangingPassword ? "Cancel Password Change" : "Change Password?"}
                </div>
                {isChangingPassword && (
                  <>
                    <input type="password" placeholder="Current Password" onChange={e => setFormData({...formData, currentPassword: e.target.value})} />
                    <input type="password" placeholder="New Password" onChange={e => setFormData({...formData, newPassword: e.target.value})} />
                    <input type="password" placeholder="Confirm New Password" onChange={e => setFormData({...formData, confirmNewPassword: e.target.value})} />
                  </>
                )}
                <button type="submit" className='btn primary'>Save Changes</button>
              </>
            )}
          </form>
          {!isEditing && currentUser?.id === id && (
            <button className='btn' onClick={() => setIsEditing(true)}>Edit Profile</button>
          )}
        </div>
        <div style={{ marginTop: '4rem' }}><UserPosts userId={id} /></div>
      </div>
    </section>
  )
}

const UserPosts = ({ userId }) => {
  const [posts, setPosts] = useState([])
  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${userId}`).then(res => setPosts(res.data))
  }, [userId])
  return (
    <div className="profile__posts">
      <div className="container posts__container">
        {posts.map(post => <PostItem key={post._id} postID={post._id} {...post} />)}
      </div>
    </div>
  )
}

export default UserProfile
