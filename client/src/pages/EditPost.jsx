import React, { useState, useEffect, useContext } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useNavigate, useParams } from 'react-router-dom'
import { UserContext } from './components/context/userContext'
import axios from '../axios' // USE YOUR CUSTOM INSTANCE
import Loader from './components/Loader'

const EditPost = () => {
  const { id } = useParams()
  const [title, setTitle] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [thumbnail, setThumbnail] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPost, setLoadingPost] = useState(true)
  const navigate = useNavigate()

  const { currentUser } = useContext(UserContext)
  const token = currentUser?.token

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      if (!token) return navigate('/login')

      try {
        setLoadingPost(true)
        const response = await axios.get(`/posts/${id}`)
        const post = response.data

        // CRITICAL FIX: Safe ID Comparison
        // We compare as strings to ensure different MongoDB ID formats don't break it
        const currentUserID = currentUser?.id?.toString()
        const postCreatorID = post.creator?.toString()

        if (currentUserID !== postCreatorID) {
          console.error("Auth mismatch:", currentUserID, "vs", postCreatorID)
          navigate('/')
          return
        }

        setTitle(post.title || '')
        setCategoryInput(post.category || '')
        setDescription(post.description || '')
      } catch (err) {
        console.error('Error fetching post:', err)
        navigate('/')
      } finally {
        setLoadingPost(false)
      }
    }
    fetchPost()
  }, [id, token, navigate, currentUser])

  const submitPost = async (e) => {
    e.preventDefault()
    if (!title.trim() || !categoryInput.trim() || !description) {
      setError("Please fill in all required fields.")
      return
    }

    setIsLoading(true)
    try {
      const form = new FormData()
      form.append('title', title.trim())
      form.append('category', categoryInput)
      form.append('description', description)
      if (thumbnail) form.append('thumbnail', thumbnail)
      if (videoFile) form.append('video', videoFile)

      await axios.patch(`/posts/${id}`, form, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}` 
        }
      })
      
      navigate(`/posts/${id}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update post')
    } finally {
      setIsLoading(false)
    }
  }

  if (loadingPost) return <Loader />

  return (
    <section className="create-post">
      <div className="container">
        <h2>Edit Post</h2>
        {error && <p className="form__error-message">{error}</p>}
        <form className="form create-post__form" onSubmit={submitPost}>
          <input type="text" placeholder='Title' value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          <input type="text" placeholder='Category' value={categoryInput} onChange={e => setCategoryInput(e.target.value)} />
          
          <ReactQuill 
             theme="snow"
             value={description} 
             onChange={setDescription} 
          />

          <label>Thumbnail (Optional)</label>
          <input type="file" onChange={e => setThumbnail(e.target.files[0])} accept='image/*' />

          <button type='submit' className='btn primary' disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default EditPost
