"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Download, Plus, Filter, Calendar, Package, Truck, MapPin } from "lucide-react"

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
  status: "pending" | "in_transit" | "delivered" | "cancelled"
}

export default function ShipmentManagement() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterMonth, setFilterMonth] = useState<string>("all")

  // Mock data for demonstration - in real app this would come from the product admin table
  const mockShipments: Shipment[] = []

  useEffect(() => {
    // Extract shipment data from localStorage (from Products tab)
    const storedProductData = localStorage.getItem('inventoryProductData')
    
    if (storedProductData) {
      try {
        const mockProductRows = JSON.parse(storedProductData)
        
        // Extract all shipments from the product data
        const allShipments: Shipment[] = []
        let shipmentId = 1
        
        mockProductRows.forEach((row: any) => {
          if (row.monthly_shipments) {
            Object.entries(row.monthly_shipments).forEach(([monthKey, monthShipments]: [string, any]) => {
              if (Array.isArray(monthShipments)) {
                monthShipments.forEach((shipment: any) => {
                  // Convert month key to readable format
                  const monthLabel = monthKey.charAt(0).toUpperCase() + monthKey.slice(1, 3) + " " + monthKey.slice(3)
                  
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
                    status: "delivered" // Default status for demo
                  })
                })
              }
            })
          }
        })
        
        setShipments(allShipments)
      } catch (error) {
        console.error("Error parsing stored product data:", error)
        setShipments([])
      }
    } else {
      setShipments([])
    }
    
    setLoading(false)
  }, [])

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
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "in_transit":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "delivered":
        return "bg-green-100 text-green-800 border-green-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳"
      case "in_transit":
        return "🚚"
      case "delivered":
        return "✅"
      case "cancelled":
        return "❌"
      default:
        return "📦"
    }
  }

  const handleExportShipments = () => {
    const csvContent = [
      "Shipment Number,Product,Customer,Warehouse,Quantity,Unit,Month,Date,Status",
      ...filteredShipments.map(shipment => 
        `${shipment.shipment_number},${shipment.product_name},${shipment.customer_name},${shipment.warehouse_name},${shipment.quantity},${shipment.unit},${shipment.month},${shipment.date},${shipment.status}`
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
                    <p className="text-sm font-medium text-yellow-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {shipments.filter(s => s.status === "pending").length}
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
                  className="pl-10 border-slate-200 focus:border-indigo-300 focus:ring-indigo-200"
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
                <option value="pending">Pending</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
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
              <CardTitle className="text-lg font-semibold text-slate-800">
                Shipments ({filteredShipments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-100 to-gray-100">
                      <th className="border border-slate-200 text-left p-3 text-slate-800 font-semibold">Shipment #</th>
                      <th className="border border-slate-200 text-left p-3 text-slate-800 font-semibold">Product</th>
                      <th className="border border-slate-200 text-left p-3 text-slate-800 font-semibold">Customer</th>
                      <th className="border border-slate-200 text-left p-3 text-slate-800 font-semibold">Warehouse</th>
                      <th className="border border-slate-200 text-center p-3 text-slate-800 font-semibold">Quantity</th>
                      <th className="border border-slate-200 text-center p-3 text-slate-800 font-semibold">Month</th>
                      <th className="border border-slate-200 text-center p-3 text-slate-800 font-semibold">Date</th>
                      <th className="border border-slate-200 text-center p-3 text-slate-800 font-semibold">Status</th>
                      <th className="border border-slate-200 text-center p-3 text-slate-800 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShipments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="border border-slate-200 text-center p-8 text-slate-500 bg-white">
                          No shipments found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredShipments.map((shipment) => (
                        <tr key={shipment.id} className="bg-white hover:bg-slate-50 transition-colors duration-200">
                          <td className="border border-slate-200 p-3 font-medium text-slate-800">
                            {shipment.shipment_number}
                          </td>
                          <td className="border border-slate-200 p-3 text-slate-700">
                            {shipment.product_name}
                          </td>
                          <td className="border border-slate-200 p-3 text-slate-700">
                            {shipment.customer_name}
                          </td>
                          <td className="border border-slate-200 p-3 text-slate-700">
                            {shipment.warehouse_name}
                          </td>
                          <td className="border border-slate-200 p-3 text-center text-slate-700">
                            <span className="font-medium">{shipment.quantity.toLocaleString()}</span>
                            <span className="text-slate-500 ml-1">{shipment.unit}</span>
                          </td>
                          <td className="border border-slate-200 p-3 text-center text-slate-700">
                            {shipment.month}
                          </td>
                          <td className="border border-slate-200 p-3 text-center text-slate-700">
                            {new Date(shipment.date).toLocaleDateString()}
                          </td>
                          <td className="border border-slate-200 p-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(shipment.status)}`}>
                              <span className="mr-1">{getStatusIcon(shipment.status)}</span>
                              {shipment.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="border border-slate-200 p-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                              >
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                              >
                                Edit
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
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
