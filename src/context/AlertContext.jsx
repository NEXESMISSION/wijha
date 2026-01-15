import { createContext, useContext, useState } from 'react'
import Alert from '../components/Alert'

export const AlertContext = createContext()

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState({
    show: false,
    type: 'info',
    title: null,
    message: '',
    onConfirm: null,
    confirmText: 'موافق',
    cancelText: 'إلغاء',
    showCancel: false,
    autoClose: false,
    autoCloseDelay: 5000
  })

  const showAlert = (options) => {
    setAlert({
      show: true,
      type: options.type || 'info',
      title: options.title || null,
      message: options.message || '',
      onConfirm: options.onConfirm || null,
      confirmText: options.confirmText || 'موافق',
      cancelText: options.cancelText || 'إلغاء',
      showCancel: options.showCancel || false,
      autoClose: options.autoClose !== undefined ? options.autoClose : false,
      autoCloseDelay: options.autoCloseDelay || 5000
    })
  }

  const hideAlert = () => {
    setAlert(prev => ({ ...prev, show: false }))
  }

  // Convenience methods
  const showSuccess = (message, title = 'نجاح', options = {}) => {
    showAlert({
      type: 'success',
      title,
      message,
      autoClose: true,
      ...options
    })
  }

  const showError = (message, title = 'خطأ', options = {}) => {
    showAlert({
      type: 'error',
      title,
      message,
      ...options
    })
  }

  const showWarning = (message, title = 'تحذير', options = {}) => {
    showAlert({
      type: 'warning',
      title,
      message,
      ...options
    })
  }

  const showInfo = (message, title = 'معلومة', options = {}) => {
    showAlert({
      type: 'info',
      title,
      message,
      autoClose: true,
      ...options
    })
  }

  const showConfirm = (message, onConfirm, title = 'تأكيد', options = {}) => {
    showAlert({
      type: 'warning',
      title,
      message,
      onConfirm,
      showCancel: true,
      confirmText: options.confirmText || 'تأكيد',
      cancelText: options.cancelText || 'إلغاء',
      ...options
    })
  }

  return (
    <AlertContext.Provider value={{
      showAlert,
      hideAlert,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showConfirm
    }}>
      {children}
      <Alert
        show={alert.show}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={hideAlert}
        onConfirm={alert.onConfirm}
        confirmText={alert.confirmText}
        cancelText={alert.cancelText}
        showCancel={alert.showCancel}
        autoClose={alert.autoClose}
        autoCloseDelay={alert.autoCloseDelay}
      />
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}

