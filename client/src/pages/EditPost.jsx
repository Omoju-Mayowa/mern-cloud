import React, { useState, useEffect, useContext } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useNavigate, useParams } from 'react-router-dom'
import { UserContext } from '../components/context/userContext' // Adjust path if needed
import axios from './components/axios' // Your custom instance with interceptors
import Loader from './components/Loader'

const scrollTop = () => {
  window.scrollTo(0, 0);
}

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
  const [categories, setCategories] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  const navigate = useNavigate()
  const { currentUser } = useContext(UserContext)
  const token = currentUser?.token

  const TITLE_LIMIT = 12000
  const DESCRIPTION_LIMIT = 50000

  // Count words helper
  const countWords = (text) => text.trim().split(/\s+/).filter(w => w.length > 0).length
  const titleWords = countWords(title)
  const descriptionWords = countWords(description.replace(/<[^>]*>/g, ''))

  // 1. Fetch Categories for the searchable input
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/categories')
        setCategories(res.data || [])
      } catch (err) {
        console.error('Failed to fetch categories', err)
      }
    }
    fetchCategories()
  }, [])

  // 2. Fetch Existing Post Data
  useEffect(() => {
    const fetchPost = async () => {
      if (!token) return navigate('/login')

      try {
        setLoadingPost(true)
        const response = await axios.get(`/posts/${id}`)
        const post = response.data

        // CRITICAL FIX: Extract ID string from the creator object
        const postCreatorID = post.creator._id || post.creator.id || post.creator;
        const currentUserID = currentUser?.id;

        // Security check: Match string to string
        if (currentUserID?.toString() !== postCreatorID?.toString()) {
          console.error("Access Denied: ID mismatch")
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

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean']
    ],
  }

  const formats = ['header', 'bold', 'italic', 'underline', 'strike', 'blockquote', 'list', 'bullet', 'indent', 'link', 'image']

  // Category search logic
  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(categoryInput.toLowerCase())
  )

  const handleCategorySelect = (catName) => {
    setCategoryInput(catName)
    setShowSuggestions(false)
  }

  const submitPost = async (e) => {
    e.preventDefault()
    setError('')
    
    if (titleWords > TITLE_LIMIT) return setError(`Title exceeds limit`)
    if (descriptionWords > DESCRIPTION_LIMIT) return setError(`Description exceeds limit`)

    setIsLoading(true)

    try {
      // Create FormData for file uploads
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
      scrollTop()
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
          <input 
            type="text" 
            placeholder='Title' 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
          <small style={{ color: titleWords > TITLE_LIMIT ? '#d32f2f' : '#666' }}>
            Words: {titleWords} / {TITLE_LIMIT}
          </small>
          
          {/* Searchable Category Input */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder='Category' 
              value={categoryInput} 
              onChange={(e) => {
                setCategoryInput(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => categoryInput.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoComplete="off"
            />
            {showSuggestions && filteredCategories.length > 0 && (
              <div className="category-suggestions" style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                backgroundColor: '#fff', border: '1px solid #ddd',
                maxHeight: '200px', overflowY: 'auto', zIndex: 10
              }}>
                {filteredCategories.map(cat => (
                  <div
                    key={cat._id}
                    onClick={() => handleCategorySelect(cat.name)}
                    style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ReactQuill theme="snow" modules={modules} formats={formats} value={description} onChange={setDescription} />
          <small style={{ color: descriptionWords > DESCRIPTION_LIMIT ? '#d32f2f' : '#666' }}>
            Words: {descriptionWords} / {DESCRIPTION_LIMIT}
          </small>

          <label>Thumbnail (leave empty to keep current)</label>
          <input type="file" onChange={e => setThumbnail(e.target.files[0])} accept='image/*' />

          <label>Video (optional)</label>
          <input type="file" onChange={e => setVideoFile(e.target.files[0])} accept='video/*' />

          <button type='submit' className='btn primary' disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Post'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default EditPost
