import React, { useEffect, useState, useContext } from 'react'
import { Link } from "react-router-dom"
import Logo from '../images/logo.png'
import { FaBars } from "react-icons/fa"
import { motion, AnimatePresence, stagger } from 'motion/react'
import { AiOutlineClose } from "react-icons/ai"
import { UserContext } from './context/userContext'
import usePostStream from './usePostStream'


const scrollTop = () => {
  window.scrollTo(0, 0)
}



// To control and easily modify links

const menuVariants = {
  hidden: { opacity: 0, y: -50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { scategorygerChildren: 0.2, duration: 0.4, stagger: 0.7 }
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3, stagger: 0.7 } }
}

const itemVariants = {
  hidden: { opacity: 0, x: 100 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 50 }
}



const Header = () => {
  const [isNavShowing, setIsNavShowing] = useState(window.innerWidth > 1024)
  const {currentUser, setCurrentUser} = useContext(UserContext)

  // Real-time updates for current user profile
  usePostStream((event, payload) => {
    if (event === 'profile_updated' && currentUser && String(payload._id) === String(currentUser.id)) {
      // Update current user in context
      setCurrentUser(prev => ({
        ...prev,
        name: payload.name,
        avatar: payload.avatar,
        email: payload.email
      }))
    }
  })

  const links = [
    {name: `${currentUser?.name}`, path: `/profile/${currentUser?.id}`},
    {name: 'Dashboard', path: '/dashboard'},
    {name: 'Create Post', path: '/create'},
    {name: 'Popular', path: '/popular'},
    {name: 'Search', path: '/search'},
    {name: 'Authors', path: '/authors'},
    {name: 'Logout', path: '/logout'},
    {name: 'Login', path: '/login'}
  ]

  
  // Determine which links to show based on login status
  const getNavLinks = () => {
    if (currentUser) {
      // User is logged in - show all links except Login
      return links.filter(link => link.name !== 'Login')
    } else {
      // User is not logged in - show only Authors and Login
      return links.filter(link => link.name === 'Authors' || link.name === 'Login')
    }
  }

  const closeNavHandler = () => {
    if (window.innerWidth < 1024) {
      setIsNavShowing(false)
    } else {
      setIsNavShowing(true)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const nav = document.querySelector('nav')
      if (window.scrollY > 0) {
        nav.classList.add('scroll')
      } else {
        nav.classList.remove('scroll')
      }
    }

    // Attach scroll listener
    window.addEventListener('scroll', handleScroll)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, []) // Empty dependency ensures this runs only once on mount

  return (
      <nav>
        <div className="container nav__container">
          <Link to="/" className="nav__logo" onClick={scrollTop}>
            <img src={Logo} alt="Navbar Logo" />
          </Link>


          <AnimatePresence>
            {isNavShowing && (
              <motion.ul
                className="nav__menu"
                variants={menuVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {getNavLinks().map(({ name, path }, index) => (
                  <motion.li key={index} variants={itemVariants}>
                    <Link to={path} onClick={() => { closeNavHandler(); scrollTop(); }}>{name}</Link>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          <button className="nav__toggle-btn" onClick={() => setIsNavShowing(!isNavShowing)}>
            {isNavShowing ? <AiOutlineClose /> : <FaBars />}
          </button>
        </div>
      </nav>
  )
}

export default Header
