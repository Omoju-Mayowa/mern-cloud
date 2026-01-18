import React, { useState, useEffect, useContext } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { FaEdit } from 'react-icons/fa'
import { UserContext } from './components/context/userContext'
import PostItem from './components/PostItem'
import usePostStream from './components/usePostStream'
import Loader from './components/Loader'

const scrollTop = () => window.scrollTo(0, 0);

const UserProfile = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  const token = currentUser?.token
  const isOwnProfile = currentUser?.id === id

  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  const resolveAvatar = (path) => {
    if (!path || path.includes('default')) return `${assetsBase}/avatars/default-avatar.png`;
    return path.startsWith('http') ? path : `${assetsBase}/avatars/${path}`;
  }

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`)
        setUserData(response.data)
        setFormData(prev => ({ ...prev, name: response.data.name, email: response.data.email }))
        setAvatarPreview(resolveAvatar(response.data.avatar))
      } catch (err) {
        setError('Failed to load user profile.')
      } finally {
        setLoading(false)
      }
    }
    fetchUserData()
  }, [id])

  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(id)) {
      setUserData(payload)
      setAvatarPreview(resolveAvatar(payload.avatar))
    }
  })

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    const form = new FormData()
    form.append('name', formData.name)
    form.append('email', formData.email)
    if (avatarFile) form.append('avatar', avatarFile)

    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`, form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      })
      setUserData(response.data)
      setIsEditing(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed')
    }
  }

  if (loading) return <section className="profile"><Loader /></section>

  return (
    <section className="profile">
      <div className="container profile__container">
        {isOwnProfile && <Link to={`/dashboard`} className="btn">My Posts</Link>}

        <div className="profile__details">
          <div className="avatar__wrapper">
            <div className="profile__avatar">
              <img src={avatarPreview} alt="User Avatar" onError={(e) => e.target.src = `${assetsBase}/avatars/default-avatar.png`} />
            </div>
            {isEditing && (
              <form className="avatar__form">
                <input type="file" id="avatar" accept='image/*' onChange={handleAvatarChange} />
                <label htmlFor="avatar"><FaEdit /></label>
              </form>
            )}
          </div>

          <h1>{userData?.name}</h1>
          <p className="profile__email">{userData?.email}</p>
          {error && <p className="form__error-message">{error}</p>}

          {isEditing ? (
            <form className="form profile__form" onSubmit={handleSaveProfile}>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder='Full Name'/>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder='Email'/>
              <button type="submit" className='btn primary'>Save Changes</button>
              <button type="button" className='btn' onClick={() => setIsEditing(false)}>Cancel</button>
            </form>
          ) : (
            isOwnProfile && <button className='btn primary' onClick={() => setIsEditing(true)}><FaEdit /> Edit Profile</button>
          )}
        </div>
        <UserPosts userId={id} />
      </div>
    </section>
  )
}

const UserPosts = ({ userId }) => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${userId}`)
        setPosts(res.data)
      } finally { setLoading(false) }
    }
    fetchPosts()
  }, [userId])

  if (loading) return <Loader size='small' />

  return (
    <div className="profile__posts">
      <h2>Posts ({posts.length})</h2>
      <div className="container posts__container">
        {posts.map(post => <PostItem key={post._id} postID={post._id} {...post} />)}
      </div>
    </div>
  )
}

export default UserProfile
