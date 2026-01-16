import React, {useContext, useEffect} from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from './components/context/userContext'


const Logout = () => {
  const {setCurrentUser} = useContext(UserContext)
  const navigate = useNavigate()

  setCurrentUser(null)

  useEffect(() => {
    navigate('/login')
  }, [])


  return (
    <></>
  )
}

export default Logout