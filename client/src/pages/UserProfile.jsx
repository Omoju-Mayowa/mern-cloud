import React, { useState, useEffect, useContext } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { FaEdit } from 'react-icons/fa'
import { FaCheck } from 'react-icons/fa'
import { UserContext } from './components/context/userContext'
import PostItem from './components/PostItem'
import usePostStream from './components/usePostStream'


const scrollTop = () => {
  window.scrollTo(0, 0);
}

const UserProfile = () => {
  const { id } = useParams()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  })
  const [avatar, setAvatar] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const navigate = useNavigate()
  const {currentUser} = useContext(UserContext)
  const token = currentUser?.token
  const isOwnProfile = currentUser?.id === id

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`)
        setUserData(response.data)
        setFormData({
          name: response.data.name || '',
          email: response.data.email || '',
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: ''
        })
        if (response.data.avatar) {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
          const assetsBase = baseUrl.replace('/api', '') || baseUrl
          setAvatar(`${assetsBase}/uploads/${response.data.avatar}`)
        } else {
          // Set default avatar if none exists
          const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
          const assetsBase = baseUrl.replace('/api', '') || baseUrl
          setAvatar(`${assetsBase}/uploads/avatar-default.png`)
        }
        setError('')
      } catch (err) {
        console.error('Error fetching user:', err)
        setError('Failed to load user profile.')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [id])

  // Real-time profile updates via SSE
  usePostStream((event, payload) => {
    if (event === 'profile_updated' && String(payload._id) === String(id)) {
      // Update user data in real-time
      setUserData(payload)
      setFormData(prev => ({
        ...prev,
        name: payload.name || prev.name,
        email: payload.email || prev.email
      }))
      if (payload.avatar) {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
        const assetsBase = baseUrl.replace('/api', '') || baseUrl
        setAvatar(`${assetsBase}/uploads/${payload.avatar}`)
      }
    } else if (event === 'post_created' || event === 'post_deleted') {
      // Update post count in real-time
      if (String(payload.creator || payload.userId) === String(id)) {
        const fetchUserData = async () => {
          try {
            const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`)
            setUserData(response.data)
          } catch (err) {
            console.error('Error refetching user data:', err)
          }
        }
        fetchUserData()
      }
    }
  })

  //redirect to login page if not own profile and trying to edit
  useEffect(() => {
    if(!token && isEditing) {
      navigate('/login')
    }
  }, [token, isEditing, navigate])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setAvatar(event.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!isOwnProfile || !token) {
      setError('You can only edit your own profile.')
      return
    }

    try {
      setError('')
      
      // If changing password, use edit-user endpoint (handles password + profile)
      if (isChangingPassword && formData.newPassword) {
        if (!formData.currentPassword) {
          setError('Current password is required to change password.')
          return
        }
        if (formData.newPassword !== formData.confirmNewPassword) {
          setError('New passwords do not match.')
          return
        }
        
        // Update password and profile via edit-user endpoint
        const passwordData = {
          name: formData.name,
          email: formData.email,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          confirmNewPassword: formData.confirmNewPassword
        }
        
        const response = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/edit-user`, passwordData, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        
        // Also update avatar if provided
        if (avatarFile) {
          const formDataToSend = new FormData()
          formDataToSend.append('name', formData.name)
          formDataToSend.append('email', formData.email)
          formDataToSend.append('avatar', avatarFile)
          
          const avatarResponse = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`, formDataToSend, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          })
          
          setUserData(avatarResponse.data)
          if (avatarResponse.data.avatar) {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
            const assetsBase = baseUrl.replace('/api', '') || baseUrl
            setAvatar(`${assetsBase}/uploads/${avatarResponse.data.avatar}`)
          }
        } else {
          setUserData(response.data)
        }
      } else {
        // Handle profile update only (name, email, avatar) - no password change
        const formDataToSend = new FormData()
        formDataToSend.append('name', formData.name)
        formDataToSend.append('email', formData.email)
        
        if (avatarFile) {
          formDataToSend.append('avatar', avatarFile)
        }

        const response = await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/users/${id}`, formDataToSend, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        })
        
        setUserData(response.data)
        
        // Update avatar if it was changed
        if (response.data.avatar) {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
          const assetsBase = baseUrl.replace('/api', '') || baseUrl
          setAvatar(`${assetsBase}/uploads/${response.data.avatar}`)
        }
      }

      setIsEditing(false)
      setIsChangingPassword(false)
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }))
      setError('')
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err.response?.data?.message || 'Failed to update profile.')
    }
  }

  if (loading) {
    return (
      <section className="profile">
        <div className="center">
          <p>Loading profile...</p>
        </div>
      </section>
    )
  }

  if (!userData) {
    return (
      <section className="profile">
        <div className="center">
          <p>User not found.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="profile">
      <div className="container profile__container">
        {isOwnProfile && (
          <Link to={`/dashboard`} onClick={scrollTop} className="btn">My Posts</Link>
        )}

        <div className="profile__details">
          {isEditing && isOwnProfile && (
            <div className="avatar__wrapper">
              <div className="profile__avatar">
                <img src={avatar || `${(import.meta.env.VITE_API_BASE_URL || '').replace('/api', '')}/uploads/avatar-default.png`} alt="User Avatar" />
              </div>
              <form className="avatar__form">
                <input type="file" name="avatar" id="avatar" accept='.png, .jpg, .jpeg, .webp' onChange={handleAvatarChange} />
                <label htmlFor="avatar"><FaEdit /></label>
              </form>
            </div>
          )}
          
          {!isEditing && (
            <div className="avatar__wrapper">
              <div className="profile__avatar">
                <img src={avatar || `${(import.meta.env.VITE_API_BASE_URL || '').replace('/api', '')}/uploads/avatar-default.png`} alt="User Avatar" />
              </div>
            </div>
          )}

          <h1>{userData.name}</h1>
          <p className="profile__email">{userData.email}</p>

          {error && <p className="form__error-message">{error}</p>}

          {isEditing && isOwnProfile ? (
            <form className="form profile__form" onSubmit={handleSaveProfile}>
              <input 
                type="text" 
                name="name"
                placeholder='Full Name' 
                value={formData.name} 
                onChange={handleInputChange}
              />
              <input 
                type="email" 
                name="email"
                placeholder='Email' 
                value={formData.email} 
                onChange={handleInputChange}
              />
              
              {!isChangingPassword ? (
                <button 
                  type="button" 
                  className='btn'
                  onClick={() => setIsChangingPassword(true)}
                >
                  Change Password
                </button>
              ) : (
                <>
                  <input 
                    type="password" 
                    name="currentPassword"
                    placeholder='Current Password' 
                    value={formData.currentPassword} 
                    onChange={handleInputChange}
                  />
                  <input 
                    type="password" 
                    name="newPassword"
                    placeholder='New Password' 
                    value={formData.newPassword} 
                    onChange={handleInputChange}
                  />
                  <input 
                    type="password" 
                    name="confirmNewPassword"
                    placeholder='Confirm New Password' 
                    value={formData.confirmNewPassword} 
                    onChange={handleInputChange}
                  />
                  <button 
                    type="button" 
                    className='btn'
                    onClick={() => {
                      setIsChangingPassword(false)
                      setFormData(prev => ({
                        ...prev,
                        currentPassword: '',
                        newPassword: '',
                        confirmNewPassword: ''
                      }))
                    }}
                  >
                    Cancel Password Change
                  </button>
                </>
              )}
              
              <button type="submit" className='btn primary'>Save Changes</button>
              <button 
                type="button" 
                className='btn'
                onClick={() => {
                  setIsEditing(false)
                  setIsChangingPassword(false)
                  setFormData(prev => ({
                    ...prev,
                    currentPassword: '',
                    newPassword: '',
                    confirmNewPassword: ''
                  }))
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="profile__actions">
              {isOwnProfile && (
                <button 
                  className='btn primary'
                  onClick={() => setIsEditing(true)}
                >
                  <FaEdit /> Edit Profile
                </button>
              )}
            </div>
          )}

          <div className="profile__stats">
            <div className="profile__stat">
              <h5>Posts</h5>
              <p>{userData.posts || 0}</p>
            </div>
          </div>
        </div>
        
        {/* User's Posts Section */}
        <UserPosts userId={id} />
      </div>
    </section>
  )
}

// Component to display user's posts
const UserPosts = ({ userId }) => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchUserPosts = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts/users/${userId}`)
        setPosts(Array.isArray(response.data) ? response.data : [])
        setError('')
      } catch (err) {
        console.error('Error fetching user posts:', err)
        setError('Failed to load posts.')
        setPosts([])
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchUserPosts()
    }
  }, [userId])

  // Real-time updates for user's posts
  usePostStream((event, payload) => {
    if (event === 'post_created' && String(payload.creator) === String(userId)) {
      setPosts(prev => [payload, ...prev])
    } else if (event === 'post_updated') {
      const updatedPost = payload
      if (String(updatedPost.creator) === String(userId)) {
        setPosts(prev => prev.map(p => (String(p._id) === String(updatedPost._id) ? updatedPost : p)))
      }
    } else if (event === 'post_deleted') {
      setPosts(prev => prev.filter(p => String(p._id) !== String(payload.postId)))
    } else if (event === 'post_liked') {
      setPosts(prev => prev.map(p => (String(p._id) === String(payload.postId) ? { ...p, likesCount: payload.likesCount } : p)))
    }
  })

  if (loading) {
    return (
      <div className="profile__posts" style={{ marginTop: '3rem' }}>
        <h2>Posts</h2>
        <div className="center">
          <p>Loading posts...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile__posts" style={{ marginTop: '3rem' }}>
        <h2>Posts</h2>
        <div className="center">
          <p style={{ color: '#d32f2f' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="profile__posts" style={{ marginTop: '3rem' }}>
      <h2>Posts ({posts.length})</h2>
      {posts.length > 0 ? (
        <div className="container posts__container" style={{ marginTop: '2rem' }}>
          {posts.map(post => (
            <PostItem
              key={post._id || post.id}
              postID={post._id || post.id}
              thumbnail={post.thumbnail}
              videoUrl={post.videoUrl}
              category={post.category}
              title={post.title}
              description={post.description}
              authorID={post.creator || post.authorID}
              createdAt={post.createdAt}
              likesCount={post.likesCount}
              likedBy={post.likedBy}
            />
          ))}
        </div>
      ) : (
        <div className="center" style={{ marginTop: '2rem' }}>
          <p>No posts yet.</p>
        </div>
      )}
    </div>
  )
}

export default UserProfile