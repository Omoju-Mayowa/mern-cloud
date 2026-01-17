import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const scrollTop = () => {
  window.scrollTo(0, 0)
}

const Footer = () => {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    // Fetch categories from API
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/categories`)
        // Ensure response.data is an array
        const categoriesData = Array.isArray(response.data) ? response.data : []
        // Get up to 20 random categories
        const shuffled = categoriesData.sort(() => 0.5 - Math.random()).slice(0, 20)
        setCategories(shuffled)
      } catch (error) {
        console.error('Error fetching categories:', error)
        // Fallback categories
        setCategories([
          { _id: '1', name: 'Agriculture' },
          { _id: '2', name: 'Business' },
          { _id: '3', name: 'Education' },
          { _id: '4', name: 'Entertainment' },
          { _id: '5', name: 'Art' },
          { _id: '6', name: 'Investment' },
          { _id: '7', name: 'Uncategorized' },
          { _id: '8', name: 'Weather' },
          { _id: '9', name: 'Technology' },
          { _id: '10', name: 'Health' }
        ])
      }
    }

    fetchCategories()
  }, [])

  return (
    <footer>
      <div className="footer__container">
        <div className="footer__categories-grid">
          {categories.map((category, index) => {
            const name =
              category.name.length > 15
                ? category.name.slice(0, 10) + '…'
                : category.name

            return (
              <Link
                key={category._id}
                onClick={scrollTop}
                to={`/posts/categories/${category.name}`}
                className={`footer__category-item category-item-${(index % 4) + 1}`}
              >
                {name}
              </Link>
            )
          })}
        </div>

        <div className="footer__copyright">
          <small>All Rights Reserved &copy; Copyright, BlogBook Studio.</small>
        </div>
      </div>
    </footer>
  )
}

export default Footer
