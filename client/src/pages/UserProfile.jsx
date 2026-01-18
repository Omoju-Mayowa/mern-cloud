import React, { useState, useEffect, useContext } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  const [isEditing, setIsEditing] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '' })

  const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

  const resolveAvatar = (path) => {
    if (!path || path.includes('default')) return `${assetsBase}/mern/default-avatar.png`;
    return path.startsWith('http') ? path : `${assetsBase}/mern/${path}`;
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`)
        setUserData(res.data)
        setFormData({ name: res.data.name, email: res.data.email })
        setAvatarPreview(resolveAvatar(res.data.avatar))
      } finally { setLoading(false) }
    }
    fetchUser()
  }, [id])

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const form = new FormData()
    form.append('name', formData.name)
    form.append('email', formData.email)
    if (avatarFile) form.append('avatar', avatarFile)

    try {
      const res = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`, form, {
        headers: { Authorization: `Bearer ${currentUser.token}`, 'Content-Type': 'multipart/form-data' }
      })
      setUserData(res.data)
      setIsEditing(false)
    } catch (err) { alert("Update failed") }
  }

  if (loading) return <Loader />

  return (
    <section className="profile">
      <div className="container profile__container">
        <div className="profile__details">
          <div className="avatar__wrapper">
            <div className="profile__avatar">
              <img src={avatarPreview} alt="User Avatar" onError={(e) => e.target.src = `${assetsBase}/mern/default-avatar.png`} />
            </div>
            {isEditing && (
              <form className="avatar__form">
                <input type="file" id="avatar" accept='image/*' onChange={handleAvatarChange} />
                <label htmlFor="avatar"><FaEdit /></label>
              </form>
            )}
          </div>
          <h1>{userData?.name}</h1>
          {isEditing ? (
            <form className="form profile__form" onSubmit={handleSave}>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <button type="submit" className='btn primary'>Save</button>
            </form>
          ) : (
            currentUser?.id === id && <button className='btn primary' onClick={() => setIsEditing(true)}><FaEdit /> Edit</button>
          )}
        </div>
        <UserPosts userId={id} />
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
