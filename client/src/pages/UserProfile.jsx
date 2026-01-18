import React, { useState, useEffect, useContext } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { FaEdit, FaCheck } from 'react-icons/fa'
import { UserContext } from './components/context/userContext'
import PostItem from './components/PostItem'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'

const scrollTop = () => window.scrollTo(0, 0);

const UserProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  // Unified Form State
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

  // Robust URL resolver for Cloudflare R2
  const resolveUrl = (path, type = 'avatar') => {
    if (!path || path.includes('default')) {
      return `${assetsBase}/mern/default-avatar.png`;
    }
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('mern/') ? path : `mern/${path}`;
    return `${assetsBase}/${cleanPath}`;
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true)
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`)
        setUserData(res.data)
        setFormData(prev => ({ ...prev, name: res.data.name, email: res.data.email }))
        setAvatarPreview(resolveUrl(res.data.avatar))
      } catch (err) {
        setError("Failed to load user profile")
      } finally { setLoading(false) }
    }
    fetchUser()
  }, [id])

  // SSE Real-time Updates
  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(id)) {
      setUserData(payload)
      setAvatarPreview(resolveUrl(payload.avatar))
    }
  })

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    const token = currentUser?.token

    try {
      // 1. If changing password, hit the edit-user endpoint first
      if (isChangingPassword && formData.newPassword) {
        if (formData.newPassword !== formData.confirmNewPassword) {
          return setError("New passwords do not match")
        }
        await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/edit-user`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }

      // 2. Handle Name, Email, and Avatar updates
      const form = new FormData()
      form.append('name', formData.name)
      form.append('email', formData.email)
      if (avatarFile) form.append('avatar', avatarFile)

      const res = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`, form, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data' 
        }
      })

      setUserData(res.data)
      setIsEditing(false)
      setIsChangingPassword(false)
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmNewPassword: '' }))
    } catch (err) {
      setError(err.response?.data?.message || "Update failed")
    }
  }

  if (loading) return <Loader />

  return (
    <section className="profile">
      <div className="container profile__container">
        <Link to={`/posts/users/${id}`} className='btn'>My Posts</Link>

        <div className="profile__details">
          <div className="avatar__wrapper">
            <div className="profile__avatar">
              <img src={avatarPreview} alt="" onError={e => e.target.src = resolveUrl(null)} />
            </div>
            {isEditing && (
              <form className="avatar__form">
                <input type="file" name="avatar" id="avatar" accept='image/*' onChange={handleAvatarChange} />
                <label htmlFor="avatar"><FaEdit /></label>
              </form>
            )}
          </div>

          <h1>{userData?.name}</h1>

          <form className="form profile__form" onSubmit={handleSave}>
            {error && <p className="form__error-message">{error}</p>}
            
            <input type="text" placeholder='Full Name' name='name' value={formData.name} onChange={handleInputChange} disabled={!isEditing} />
            <input type="email" placeholder='Email' name='email' value={formData.email} onChange={handleInputChange} disabled={!isEditing} />
            
            {isEditing && (
              <>
                <div className="password-toggle" style={{ margin: '10px 0', cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => setIsChangingPassword(!isChangingPassword)}>
                  {isChangingPassword ? "Cancel Password Change" : "Change Password?"}
                </div>

                {isChangingPassword && (
                  <>
                    <input type="password" placeholder='Current Password' name='currentPassword' value={formData.currentPassword} onChange={handleInputChange} />
                    <input type="password" placeholder='New Password' name='newPassword' value={formData.newPassword} onChange={handleInputChange} />
                    <input type="password" placeholder='Confirm New Password' name='confirmNewPassword' value={formData.confirmNewPassword} onChange={handleInputChange} />
                  </>
                )}
                
                <button type="submit" className='btn primary'>Update Details</button>
              </>
            )}
          </form>

          {!isEditing && currentUser?.id === id && (
            <button className='btn primary' onClick={() => setIsEditing(true)}><FaEdit /> Edit Profile</button>
          )}
        </div>

        {/* Separator and Posts Section */}
        <div style={{ marginTop: '4rem' }}>
            <UserPosts userId={id} />
        </div>
      </div>
    </section>
  )
}

const UserPosts = ({ userId }) => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${userId}`)
      .then(res => {
        setPosts(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId])

  if (loading) return <Loader size='small' />

  return (
    <div className="profile__posts">
      <h2 className="center">User Posts ({posts.length})</h2>
      {posts.length > 0 ? (
        <div className="container posts__container">
          {posts.map(post => (
            <PostItem key={post._id} postID={post._id} {...post} authorID={post.creator} />
          ))}
        </div>
      ) : <h3 className='center'>No posts found.</h3>}
    </div>
  )
}

export default UserProfile;
