import React, { useState, useContext, useEffect } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useNavigate } from 'react-router-dom'
import { UserContext } from './components/context/userContext'
import axios from './components/axios' // USE YOUR CUSTOM INSTANCE FOR AUTO-LOGOUT

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const CreatePost = () => {
  const [title, setTitle] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [thumbnail, setThumbnail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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

  // Redirect if not logged in
  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  // Fetch existing categories for suggestions
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
    
    // Validations
    if (!title.trim()) return setError('Title is required')
    if (titleWords > TITLE_LIMIT) return setError(`Title exceeds word limit`)
    if (!categoryInput.trim()) return setError('Category is required')
    if (!description || description === '<p><br></p>') return setError('Description is required')
    if (descriptionWords > DESCRIPTION_LIMIT) return setError(`Description exceeds limit`)

    setIsLoading(true)

    try {
      // 1. Auto-create category if it's new
      const catExists = categories.some(c => c.name.toLowerCase() === categoryInput.toLowerCase())
      if (!catExists) {
        try {
          await axios.post('/categories', { name: categoryInput }, {
            headers: { Authorization: `Bearer ${token}` }
          })
        } catch (catErr) {
          // Ignore if 409 (already exists)
          if (catErr.response?.status !== 409) console.warn('Cat error:', catErr)
        }
      }

      // 2. Prepare Form Data
      const form = new FormData()
      form.append('title', title.trim())
      form.append('category', categoryInput)
      form.append('description', description)
      if (thumbnail) form.append('thumbnail', thumbnail)
      if (videoFile) form.append('video', videoFile)

      // 3. Submit Post
      const res = await axios.post('/posts', form, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}` 
        }
      })
      
      navigate(`/posts/${res.data._id || res.data.id}`)
      scrollTop()
    } catch (err) {
      // If token expired, the Interceptor in ../axios.js handles the redirect automatically
      setError(err.response?.data?.message || 'Failed to create post')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="create-post">
      <div className="container">
        <h2>Create Post</h2>
        {error && <p className="form__error-message">{error}</p>}
        <form className="form create-post__form" onSubmit={submitPost}>
          <input 
            type="text" 
            placeholder='Title' 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            autoFocus 
          />
          <small style={{ color: titleWords > TITLE_LIMIT ? '#d32f2f' : '#666' }}>
            Words: {titleWords} / {TITLE_LIMIT}
          </small>
          
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder='Category (search or type new)' 
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

          <label>Thumbnail (Image)</label>
          <input type="file" onChange={e => setThumbnail(e.target.files[0])} accept='image/*' />

          <label>Video (Optional)</label>
          <input type="file" onChange={e => setVideoFile(e.target.files[0])} accept='video/*' />

          <button type='submit' className='btn primary' disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Post'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default CreatePost
