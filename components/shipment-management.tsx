"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Download, Plus, Filter, Calendar, Package, Truck, MapPin, ChevronDown, RotateCw } from "lucide-react"

interface Shipment {
  id: string
  shipment_number: string
  product_name: string
  customer_name: string
  warehouse_name: string
  quantity: number
  unit: string
  month: string
  date: string
  status: "in_process" | "in_transit" | "delivered"
  link?: string
}

export default function ShipmentManagement() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterMonth, setFilterMonth] = useState<string>("all")
  const [editingLink, setEditingLink] = useState<{ shipmentId: string; link: string } | null>(null)
  const [editingStatus, setEditingStatus] = useState<{ shipmentId: string; status: string } | null>(null)

  // Mock data for demonstration - in real app this would come from the product admin table
  const mockShipments: Shipment[] = []

  const refreshShipmentData = () => {
    console.log('[ShipmentManagement] refreshShipmentData called')
    
    // First, check if we have saved status data
    const savedStatusData = localStorage.getItem('shipmentStatusData')
    let savedShipments: Shipment[] = []
    
    if (savedStatusData) {
      try {
        savedShipments = JSON.parse(savedStatusData)
        console.log('Found saved status data:', savedShipments.length, 'shipments')
      } catch (error) {
        console.error('Error parsing saved status data:', error)
      }
    }
    
    // Extract shipment data from localStorage (from Products tab)
    const storedProductData = localStorage.getItem('inventoryProductData')
    console.log('[ShipmentManagement] Stored product data found:', !!storedProductData)
    
    if (storedProductData) {
      try {
        const mockProductRows = JSON.parse(storedProductData)
        console.log('[ShipmentManagement] Parsed product data, rows:', mockProductRows.length)
        
        // Extract all shipments from the product data
        const allShipments: Shipment[] = []
        let shipmentId = 1
        
        mockProductRows.forEach((row: any) => {
          console.log('[ShipmentManagement] Processing row:', { 
            productName: row.product?.name, 
            customerName: row.customer?.name, 
            warehouseName: row.warehouse?.name,
            hasShipments: !!row.monthly_shipments,
            shipmentKeys: row.monthly_shipments ? Object.keys(row.monthly_shipments) : []
          })
          
          if (row.monthly_shipments) {
            Object.entries(row.monthly_shipments).forEach(([monthKey, monthShipments]: [string, any]) => {
              console.log('[ShipmentManagement] Processing month:', monthKey, 'shipments:', monthShipments)
              
              if (Array.isArray(monthShipments)) {
                monthShipments.forEach((shipment: any) => {
                  console.log('[ShipmentManagement] Processing shipment:', shipment)
                  
                  // Convert month key to readable format
                  const monthLabel = monthKey.charAt(0).toUpperCase() + monthKey.slice(1, 3) + " " + monthKey.slice(3)
                  
                  // Check if we have a saved status and link for this shipment
                  const savedShipment = savedShipments.find(s => s.shipment_number === shipment.shipment_number)
                  const statusToUse = savedShipment ? savedShipment.status : (shipment.status || "in_process")
                  const linkToUse = savedShipment && savedShipment.link ? savedShipment.link : `https://app.gocomet.com/tracking/${shipment.shipment_number}`
                  
                  allShipments.push({
                    id: (shipmentId++).toString(),
                    shipment_number: shipment.shipment_number,
                    product_name: row.product.name,
                    customer_name: row.customer.name,
                    warehouse_name: row.warehouse.name,
                    quantity: shipment.quantity,
                    unit: row.unit,
                    month: monthLabel,
                    date: new Date().toISOString().split('T')[0], // Use current date for demo
                    status: statusToUse, // Use saved status if available
                    link: linkToUse // Use saved link if available, otherwise default GoComet URL
                  })
                })
              }
            })
          }
        })
        
        console.log('[ShipmentManagement] Total shipments extracted:', allShipments.length)
        
        // Don't limit to 10 shipments - show all shipments
        const allShipmentsToShow = allShipments
        console.log('[ShipmentManagement] Showing all shipments:', allShipmentsToShow.length)
        
        // Clean up any malformed URLs in existing data, but preserve custom links
        const cleanedShipments = allShipmentsToShow.map(shipment => {
          if (shipment.link) {
            let cleanUrl = shipment.link.trim()
            
            // Only fix malformation if it's clearly a concatenated string issue
            if (cleanUrl.includes('http') && cleanUrl.indexOf('http') > 0) {
              const httpIndex = cleanUrl.indexOf('http')
              cleanUrl = cleanUrl.substring(httpIndex)
            }
            
            // Only reset to default if the URL is completely invalid
            const urlPattern = /^https?:\/\/[^\s]+$/i
            if (!urlPattern.test(cleanUrl)) {
              // Only use default if the URL is truly malformed
              console.log(`Invalid URL detected for shipment ${shipment.shipment_number}: ${cleanUrl}`)
              cleanUrl = `https://app.gocomet.com/tracking/${shipment.shipment_number}`
            }
            
            return { ...shipment, link: cleanUrl }
          }
          return shipment
        })
        
        setShipments(cleanedShipments)
        console.log('[ShipmentManagement] Shipments state updated with:', cleanedShipments.length, 'shipments')
        console.log('[ShipmentManagement] Shipments loaded from localStorage with preserved statuses:', cleanedShipments.length)
      } catch (error) {
        console.error("Error parsing stored product data:", error)
        setShipments([])
      }
    } else {
      // If no data in localStorage, create some sample shipments for testing
      const sampleShipments: Shipment[] = [
        {
          id: "1",
          shipment_number: "SH001",
          product_name: "Sample Product",
          customer_name: "Sample Customer",
          warehouse_name: "Sample Warehouse",
          quantity: 100,
          unit: "kg",
          month: "Dec 24",
          date: new Date().toISOString().split('T')[0],
          status: "in_process",
          link: "https://app.gocomet.com/tracking/SH001"
        },
        {
          id: "2",
          shipment_number: "SH002",
          product_name: "Test Product",
          customer_name: "Test Customer",
          warehouse_name: "Test Warehouse",
          quantity: 50,
          unit: "kg",
          month: "Jan 25",
          date: new Date().toISOString().split('T')[0],
          status: "in_transit",
          link: "https://app.gocomet.com/tracking/SH002"
        }
      ]
      setShipments(sampleShipments)
      console.log('Sample shipments created for testing:', sampleShipments.length)
    }
    
    setLoading(false)
  }

  useEffect(() => {
    refreshShipmentData()
    
    // Set up a more robust event listener system
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[ShipmentManagement] Tab became visible, refreshing data...')
        refreshShipmentData()
      }
    }
    
    // Set up periodic refresh to catch any missed updates
    const intervalId = setInterval(() => {
      console.log('[ShipmentManagement] Periodic refresh check...')
      refreshShipmentData()
    }, 5000) // Check every 5 seconds
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    console.log('[ShipmentManagement] Setting up event listeners...')
    
    // Listen for localStorage changes to refresh shipment data
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'inventoryProductData') {
        console.log('[ShipmentManagement] Storage event detected, refreshing data...')
        refreshShipmentData()
      }
    }

    // Listen for custom localStorageChange event (same window)
    const handleLocalStorageChange = () => {
      console.log('[ShipmentManagement] Received localStorageChange event, refreshing data...')
      refreshShipmentData()
    }

    // Listen for custom shipmentAdded event
    const handleShipmentAdded = () => {
      console.log('[ShipmentManagement] Received shipmentAdded event, refreshing data...')
      refreshShipmentData()
    }

    // Listen for focus events to refresh when tab becomes active
    const handleFocus = () => {
      console.log('[ShipmentManagement] Window focused, refreshing data...')
      refreshShipmentData()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('localStorageChange', handleLocalStorageChange)
    window.addEventListener('shipmentAdded', handleShipmentAdded)
    window.addEventListener('focus', handleFocus)
    
    console.log('[ShipmentManagement] Event listeners set up successfully')
    
    // Handle clicking outside status editor
    const handleClickOutside = (event: MouseEvent) => {
      if (editingStatus) {
        const target = event.target as Element
        if (!target.closest('.status-editor')) {
          console.log('Click outside detected, saving status')
          handleStatusChange(editingStatus.shipmentId, editingStatus.status)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localStorageChange', handleLocalStorageChange)
      window.removeEventListener('shipmentAdded', handleShipmentAdded)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('mousedown', handleClickOutside)
      console.log('[ShipmentManagement] Event listeners cleaned up')
    }
  }, [editingStatus])



  const filteredShipments = shipments.filter(shipment => {
    const matchesSearch = 
      shipment.shipment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.warehouse_name.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = filterStatus === "all" || shipment.status === filterStatus
    const matchesMonth = filterMonth === "all" || shipment.month === filterMonth

    return matchesSearch && matchesStatus && matchesMonth
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_process":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "in_transit":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "in_process":
        return "⏳"
      case "in_transit":
        return "🚚"
      case "delivered":
        return "✅"
      default:
        return "📦"
    }
  }

  const handleExportShipments = () => {
    const csvContent = [
      "Shipment Number,Product,Customer,Warehouse,Quantity,Unit,Month,Date,Status,Link",
      ...filteredShipments.map(shipment => 
        `${shipment.shipment_number},${shipment.product_name},${shipment.customer_name},${shipment.warehouse_name},${shipment.quantity},${shipment.unit},${shipment.month},${shipment.date},${shipment.status},${shipment.link || ''}`
      )
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `shipments_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleViewShipment = (shipment: Shipment) => {
    if (shipment.link) {
      // Clean up the URL if it's malformed
      let cleanUrl = shipment.link.trim()
      
      // Fix common malformation patterns
      if (cleanUrl.includes('http') && cleanUrl.indexOf('http') > 0) {
        // Extract the actual URL part
        const httpIndex = cleanUrl.indexOf('http')
        cleanUrl = cleanUrl.substring(httpIndex)
      }
      
      // Validate the cleaned URL
      const urlPattern = /^https?:\/\/[^\s]+$/i
      if (!urlPattern.test(cleanUrl)) {
        alert('Invalid URL format detected. Please edit this link to fix the URL.')
        return
      }
      
      // Open the link in a new tab
      window.open(cleanUrl, '_blank', 'noopener,noreferrer')
    } else {
      // Fallback: show an alert if no link is available
      alert(`No link available for shipment ${shipment.shipment_number}`)
    }
  }

  const handleEditLink = (shipment: Shipment) => {
    // If no link exists, suggest a default pattern
    const defaultLink = shipment.link || `https://app.gocomet.com/tracking/${shipment.shipment_number}`
    setEditingLink({ shipmentId: shipment.id, link: defaultLink })
  }

  const handleSaveLink = () => {
    if (editingLink) {
      // Enhanced URL validation
      const urlPattern = /^https?:\/\/[^\s]+$/i
      if (editingLink.link && !urlPattern.test(editingLink.link)) {
        alert('Please enter a valid URL starting with http:// or https:// and without spaces or special characters')
        return
      }
      
      // Check for common URL malformation patterns
      if (editingLink.link && editingLink.link.includes('http') && editingLink.link.indexOf('http') > 0) {
        alert('Invalid URL format detected. Please ensure the URL starts with http:// or https://')
        return
      }
      
      const updatedShipments = shipments.map(shipment => 
        shipment.id === editingLink.shipmentId 
          ? { ...shipment, link: editingLink.link }
          : shipment
      )
      setShipments(updatedShipments)
      setEditingLink(null)
      
      // Save the updated link to localStorage for persistence
      try {
        const shipmentsToSave = updatedShipments.map(shipment => ({
          id: shipment.id,
          shipment_number: shipment.shipment_number,
          product_name: shipment.product_name,
          customer_name: shipment.customer_name,
          warehouse_name: shipment.warehouse_name,
          quantity: shipment.quantity,
          unit: shipment.unit,
          month: shipment.month,
          date: shipment.date,
          status: shipment.status,
          link: shipment.link
        }))
        
        localStorage.setItem('shipmentStatusData', JSON.stringify(shipmentsToSave))
        console.log('Link saved to localStorage:', editingLink.link)
      } catch (error) {
        console.error("Error saving link to localStorage:", error)
      }
      
      // Show confirmation
      console.log('Link updated successfully:', editingLink.link)
      alert(`Link updated successfully! The new link will persist across page refreshes.`)
    }
  }

  const handleCancelEdit = () => {
    setEditingLink(null)
  }

  const handleStatusChange = (shipmentId: string, newStatus: string) => {
    console.log('Status change handler called for shipment:', shipmentId, 'new status:', newStatus)
    
    // Validate the new status
    const validStatuses = ['in_process', 'in_transit', 'delivered']
    if (!validStatuses.includes(newStatus)) {
      console.error('Invalid status:', newStatus)
      alert('Invalid status selected. Please choose a valid status.')
      return
    }
    
    // Find the shipment to update
    const shipmentToUpdate = shipments.find(s => s.id === shipmentId)
    if (!shipmentToUpdate) {
      console.error('Shipment not found:', shipmentId)
      alert('Shipment not found. Please refresh the page and try again.')
      return
    }
    
    console.log('Updating shipment:', shipmentToUpdate.shipment_number, 'from', shipmentToUpdate.status, 'to', newStatus)
    
    // Update the shipments state immediately
    const updatedShipments = shipments.map(shipment => 
      shipment.id === shipmentId 
        ? { ...shipment, status: newStatus as "in_process" | "in_transit" | "delivered" }
        : shipment
    )
    
    // Update state first
    setShipments(updatedShipments)
    console.log('Shipments state updated with new status:', newStatus)
    
    // Clear editing state
    setEditingStatus(null)
    console.log('Editing status cleared')
    
    // Simple localStorage update - just save the current shipments array
    try {
      const shipmentsToSave = updatedShipments.map(shipment => ({
        id: shipment.id,
        shipment_number: shipment.shipment_number,
        product_name: shipment.product_name,
        customer_name: shipment.customer_name,
        warehouse_name: shipment.warehouse_name,
        quantity: shipment.quantity,
        unit: shipment.unit,
        month: shipment.month,
        date: shipment.date,
        status: shipment.status,
        link: shipment.link
      }))
      
      localStorage.setItem('shipmentStatusData', JSON.stringify(shipmentsToSave))
      console.log('Status saved to localStorage:', newStatus)
    } catch (error) {
      console.error("Error saving to localStorage:", error)
    }
    
    // Show success message
    console.log('Status update completed successfully to:', newStatus)
  }

  const handleStatusClick = (shipment: Shipment) => {
    console.log('Status click handler called for shipment:', shipment.id, 'current status:', shipment.status)
    
    // Clear any existing editing state first
    setEditingLink(null)
    
    // Set the new editing status
    setEditingStatus({ shipmentId: shipment.id, status: shipment.status })
    console.log('Editing status set to:', { shipmentId: shipment.id, status: shipment.status })
    
    // Force a re-render by updating the state
    setTimeout(() => {
      console.log('Editing status after timeout:', editingStatus)
    }, 100)
  }

  const handleCancelStatusEdit = () => {
    setEditingStatus(null)
  }

  const handleDeleteShipment = (shipmentId: string) => {
    if (confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) {
      const updatedShipments = shipments.filter(shipment => shipment.id !== shipmentId)
      setShipments(updatedShipments)
      
      // Update localStorage to persist the deletion
      const storedProductData = localStorage.getItem('inventoryProductData')
      if (storedProductData) {
        try {
          const mockProductRows = JSON.parse(storedProductData)
          
          // Remove the shipment from the stored data
          const updatedProductRows = mockProductRows.map((row: any) => {
            if (row.monthly_shipments) {
              const updatedMonthlyShipments = { ...row.monthly_shipments }
              
              Object.keys(updatedMonthlyShipments).forEach(monthKey => {
                if (Array.isArray(updatedMonthlyShipments[monthKey])) {
                  updatedMonthlyShipments[monthKey] = updatedMonthlyShipments[monthKey].filter((shipment: any) => {
                    // Find the shipment to delete by matching shipment number
                    const shipmentToDelete = shipments.find(s => s.id === shipmentId)
                    return shipment.shipment_number !== shipmentToDelete?.shipment_number
                  })
                }
              })
              
              return { ...row, monthly_shipments: updatedMonthlyShipments }
            }
            return row
          })
          
          localStorage.setItem('inventoryProductData', JSON.stringify(updatedProductRows))
          
          // Trigger custom event to notify other components
          window.dispatchEvent(new CustomEvent('localStorageChange'))
        } catch (error) {
          console.error("Error updating stored product data:", error)
        }
      }
      
      console.log('Shipment deleted successfully')
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          <div className="text-lg font-semibold text-slate-700">Loading shipment data...</div>
          <div className="text-sm text-slate-500">Please wait while we fetch your shipment information</div>
        </div>
      </div>
    )
  }

  // Debug logging
  console.log('Current editingStatus:', editingStatus)
  console.log('Current shipments count:', shipments.length)
  console.log('Filtered shipments count:', filteredShipments.length)

  return (
    <div>
      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
        <CardContent className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Shipment Management</h1>
              <p className="text-slate-600 text-sm font-medium">Track and manage all your shipments</p>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('[ShipmentManagement] Manual refresh triggered')
                  refreshShipmentData()
                }}
                className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800 transition-all duration-200 shadow-sm rounded-lg font-medium"
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportShipments}
                className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-all duration-200 shadow-sm rounded-lg font-medium"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              <Button
                size="sm"
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-2 rounded-xl font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Shipment
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Shipments</p>
                    <p className="text-2xl font-bold text-blue-900">{shipments.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-600">In Process</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {shipments.filter(s => s.status === "in_process").length}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">In Transit</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {shipments.filter(s => s.status === "in_transit").length}
                    </p>
                  </div>
                  <Truck className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Delivered</p>
                    <p className="text-2xl font-bold text-green-900">
                      {shipments.filter(s => s.status === "delivered").length}
                    </p>
                  </div>
                  <MapPin className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search shipments by number, product, customer, or warehouse..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-slate-200 focus:border-indigo-300 focus:ring-indigo-200 text-black placeholder:text-gray-600"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 focus:border-indigo-300 focus:ring-indigo-200"
              >
                <option value="all">All Status</option>
                <option value="in_process">In Process</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
              </select>

              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 focus:border-indigo-300 focus:ring-indigo-200"
              >
                <option value="all">All Months</option>
                <option value="Dec 24">Dec 24</option>
                <option value="Jan 25">Jan 25</option>
                <option value="Feb 25">Feb 25</option>
                <option value="Mar 25">Mar 25</option>
                <option value="Apr 25">Apr 25</option>
                <option value="May 25">May 25</option>
                <option value="Jun 25">Jun 25</option>
                <option value="Jul 25">Jul 25</option>
                <option value="Aug 25">Aug 25</option>
                <option value="Sep 25">Sep 25</option>
                <option value="Oct 25">Oct 25</option>
                <option value="Nov 25">Nov 25</option>
                <option value="Dec 25">Dec 25</option>
              </select>
            </div>
          </div>

          {/* Shipments Table */}
          <Card className="shadow-lg border-0">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold text-slate-800">
                  Shipments ({filteredShipments.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('Test button clicked')
                      console.log('Current editingStatus:', editingStatus)
                      console.log('Current shipments:', shipments)
                      if (shipments.length > 0) {
                        console.log('First shipment status:', shipments[0].status)
                        handleStatusClick(shipments[0])
                      }
                    }}
                    className="text-xs px-2 py-1"
                  >
                    Test Status Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('=== STATUS PERSISTENCE TEST ===')
                      console.log('Current shipments:', shipments)
                      console.log('localStorage data:', localStorage.getItem('inventoryProductData'))
                      if (shipments.length > 0) {
                        const firstShipment = shipments[0]
                        console.log('First shipment details:', firstShipment)
                        console.log('Status should persist as:', firstShipment.status)
                      }
                    }}
                    className="text-xs px-2 py-1 bg-green-100 text-green-700"
                  >
                    Test Persistence
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('=== EVENT SYSTEM TEST ===')
                      console.log('Dispatching test localStorageChange event...')
                      window.dispatchEvent(new Event('localStorageChange'))
                      console.log('Test event dispatched')
                    }}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700"
                  >
                    Test Event
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-100 to-gray-100">
                      <th className="border border-slate-200 text-left p-2 text-slate-800 font-semibold text-xs">Shipment #</th>
                      <th className="border border-slate-200 text-left p-2 text-slate-800 font-semibold text-xs">Product</th>
                      <th className="border border-slate-200 text-left p-2 text-slate-800 font-semibold text-xs">Customer</th>
                      <th className="border border-slate-200 text-left p-2 text-slate-800 font-semibold text-xs">Warehouse</th>
                      <th className="border border-slate-200 text-center p-2 text-slate-800 font-semibold text-xs">Quantity</th>
                      <th className="border border-slate-200 text-center p-2 text-slate-800 font-semibold text-xs">Month</th>
                      <th className="border border-slate-200 text-center p-2 text-slate-800 font-semibold text-xs">Date</th>
                      <th className="border border-slate-200 text-center p-2 text-slate-800 font-semibold text-xs">Status</th>
                      <th className="border border-slate-200 text-center p-2 text-slate-800 font-semibold text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShipments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="border border-slate-200 text-center p-6 text-slate-500 bg-white text-xs">
                          No shipments found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredShipments.map((shipment) => (
                        <tr key={shipment.id} className="bg-white hover:bg-slate-50 transition-colors duration-200">
                          <td className="border border-slate-200 p-2 font-medium text-slate-800 text-xs">
                            {shipment.shipment_number}
                          </td>
                          <td className="border border-slate-200 p-2 text-slate-700 text-xs">
                            {shipment.product_name}
                          </td>
                          <td className="border border-slate-200 p-2 text-slate-700 text-xs">
                            {shipment.customer_name}
                          </td>
                          <td className="border border-slate-200 p-2 text-slate-700 text-xs">
                            {shipment.warehouse_name}
                          </td>
                          <td className="border border-slate-200 p-2 text-center text-slate-700 text-xs">
                            <span className="font-medium">{shipment.quantity.toLocaleString()}</span>
                            <span className="text-slate-500 ml-1">{shipment.unit}</span>
                          </td>
                          <td className="border border-slate-200 p-2 text-center text-slate-700 text-xs">
                            {shipment.month}
                          </td>
                          <td className="border border-slate-200 p-2 text-center text-slate-700 text-xs">
                            {new Date(shipment.date).toLocaleDateString()}
                          </td>
                          <td className="border border-slate-200 p-2 text-center">
                            {editingStatus?.shipmentId === shipment.id ? (
                              <div className="relative status-editor">
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-md">
                                  Editing...
                                </div>
                                <select
                                  value={editingStatus.status}
                                  onChange={(e) => {
                                    console.log('Select onChange triggered:', e.target.value)
                                    handleStatusChange(shipment.id, e.target.value)
                                  }}
                                  className="w-full px-2 py-1 border-2 border-blue-300 rounded-lg text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white shadow-sm"
                                  autoFocus
                                  size={3}
                                >
                                  <option value="in_process">⏳ IN PROCESS</option>
                                  <option value="in_transit">🚚 IN TRANSIT</option>
                                  <option value="delivered">✅ DELIVERED</option>
                                </select>
                                <div className="absolute -top-2 -right-2">
                                  <button
                                    onClick={() => {
                                      console.log('Cancel button clicked')
                                      handleCancelStatusEdit()
                                    }}
                                    className="bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md"
                                    title="Cancel editing"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  console.log('Status div clicked for shipment:', shipment.id)
                                  handleStatusClick(shipment)
                                }}
                                className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105 ${getStatusColor(shipment.status)}`}
                                title="Click to edit status"
                              >
                                <span className="mr-1">{getStatusIcon(shipment.status)}</span>
                                {shipment.status.replace('_', ' ').toUpperCase()}
                                <ChevronDown className="ml-1 h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />
                              </div>
                            )}
                          </td>
                          <td className="border border-slate-200 p-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-6 px-2 text-xs ${
                                  shipment.link 
                                    ? "border-green-200 text-green-600 hover:bg-green-50" 
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                                onClick={() => handleViewShipment(shipment)}
                                title={shipment.link ? `Open ${shipment.link} in new tab` : "No link available"}
                              >
                                {shipment.link ? "🔗 Link" : "View"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                onClick={() => handleEditLink(shipment)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteShipment(shipment.id)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Link Edit Modal */}
          {editingLink && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96 max-w-md">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Edit Shipment Link</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Link URL
                    </label>
                    <Input
                      type="url"
                      value={editingLink.link}
                      onChange={(e) => setEditingLink({ ...editingLink, link: e.target.value })}
                      placeholder="https://app.gocomet.com/tracking/..."
                      className="w-full"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      Current value: {editingLink.link || 'No link set'}
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveLink}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* Info Box */}
          <Card className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Package className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-indigo-800 mb-2">Shipment Information</h3>
                  <p className="text-indigo-700 text-sm leading-relaxed">
                    This tab displays all shipments that have been added through the "+ Shipment" button in the Products tab. 
                    Each shipment includes details like shipment number, product, customer, warehouse, quantity, month, and status. 
                    You can filter shipments by status and month, search for specific shipments, and export the data as needed.
                  </p>
                  <div className="mt-3 p-3 bg-indigo-100 rounded-lg">
                    <p className="text-indigo-800 text-xs font-medium">
                      💡 <strong>How to add shipments:</strong> Go to the Products tab, find any month column, and click the "+ Shipment" button to add shipment details.
                    </p>
                  </div>
                  
                  {/* Debug Information */}
                  <div className="mt-4 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
                    <h4 className="text-yellow-800 text-sm font-semibold mb-2">🔧 Debug Information</h4>
                    <div className="text-yellow-700 text-xs space-y-1">
                      <p><strong>Current shipments count:</strong> {shipments.length}</p>
                      <p><strong>localStorage data available:</strong> {localStorage.getItem('inventoryProductData') ? 'Yes' : 'No'}</p>
                      <p><strong>Last refresh:</strong> {new Date().toLocaleTimeString()}</p>
                      <p><strong>Event listeners active:</strong> ✅</p>
                      <p><strong>Periodic refresh:</strong> Every 5 seconds</p>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          console.log('=== DEBUG: Current State ===')
                          console.log('Shipments:', shipments)
                          console.log('localStorage:', localStorage.getItem('inventoryProductData'))
                          console.log('Event listeners:', 'Active')
                        }}
                        className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 hover:bg-yellow-300"
                      >
                        Log State
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          localStorage.removeItem('inventoryProductData')
                          localStorage.removeItem('shipmentStatusData')
                          console.log('localStorage cleared')
                          refreshShipmentData()
                        }}
                        className="text-xs px-2 py-1 bg-red-200 text-red-800 hover:bg-red-300"
                      >
                        Clear Cache
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
