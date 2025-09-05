"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Download, Plus, Filter, Calendar } from "lucide-react"

interface LogisticsRecord {
  id: string
  shipDate: string
  customer: string
  customerPO: string
  roNumber: string
  incoterm: string
  source: string
  ocApproval: boolean
  pickupInstructionsSent: boolean
  plSent: boolean
  coaSent: boolean
  rfq: boolean
  carrierRate: number | null
  transportType: string
  invoiceNumber: string | null
  invoiceSent: boolean
  pickupDeliveryTracking: string
  attachedDocsOnIGL: boolean
  reeferInPUInstructions: boolean
  bimboReadables: boolean
  pickupBOLSent: boolean
}

export default function LogisticsTracking() {
  const [logisticsRecords, setLogisticsRecords] = useState<LogisticsRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedDate, setSelectedDate] = useState("")

  // Sample data based on the screenshot
  const sampleData: LogisticsRecord[] = [
    {
      id: "1",
      shipDate: "1-Aug",
      customer: "Crest Food",
      customerPO: "088973-ELB-001 Line #4",
      roNumber: "088973-ELB-001 Line #4",
      incoterm: "DDP",
      source: "Woods",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: true,
      carrierRate: 500,
      transportType: "FTL",
      invoiceNumber: "4784",
      invoiceSent: true,
      pickupDeliveryTracking: "",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: false,
    },
    {
      id: "2",
      shipDate: "3-Aug",
      customer: "Alpha Baking",
      customerPO: "2692043",
      roNumber: "126302",
      incoterm: "EXW",
      source: "IGL",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: false,
      carrierRate: null,
      transportType: "",
      invoiceNumber: "4785",
      invoiceSent: true,
      pickupDeliveryTracking: "",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: false,
    },
    {
      id: "3",
      shipDate: "11-Aug",
      customer: "ICC",
      customerPO: "BL349314",
      roNumber: "126310",
      incoterm: "CFR",
      source: "F-932",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: false,
      carrierRate: null,
      transportType: "",
      invoiceNumber: "4731",
      invoiceSent: true,
      pickupDeliveryTracking: "Shipped",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: false,
    },
    {
      id: "4",
      shipDate: "18-Aug",
      customer: "Bimbo",
      customerPO: "G076200657657 - repallet",
      roNumber: "125519",
      incoterm: "CIF Costa Rica",
      source: "F-886",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: true,
      carrierRate: 525,
      transportType: "FTL",
      invoiceNumber: "4789",
      invoiceSent: true,
      pickupDeliveryTracking: "",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: true,
      pickupBOLSent: false,
    },
    {
      id: "5",
      shipDate: "18-Aug",
      customer: "American Ingredients",
      customerPO: "",
      roNumber: "",
      incoterm: "CIF Santos",
      source: "GWI Chino",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: true,
      carrierRate: 1150,
      transportType: "FTL",
      invoiceNumber: "4793",
      invoiceSent: true,
      pickupDeliveryTracking: "",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: false,
    },
    {
      id: "6",
      shipDate: "18-Aug",
      customer: "Bimbo",
      customerPO: "",
      roNumber: "",
      incoterm: "EXW+FRT",
      source: "Woods fm F-871",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: true,
      carrierRate: 425,
      transportType: "FTL",
      invoiceNumber: "4807",
      invoiceSent: true,
      pickupDeliveryTracking: "Woods Confirmed | Carrier Confirmed | 08/14 @ 9 AM",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: true,
      pickupBOLSent: true,
    },
    {
      id: "7",
      shipDate: "18-Aug",
      customer: "Bimbo",
      customerPO: "",
      roNumber: "",
      incoterm: "EXW+FRT",
      source: "Woods fm F-871",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: false,
      carrierRate: null,
      transportType: "",
      invoiceNumber: "4812",
      invoiceSent: true,
      pickupDeliveryTracking: "Woods Confirmed | Carrier Confirmed | 08/14 @ 9 AM",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: true,
      pickupBOLSent: true,
    },
    {
      id: "8",
      shipDate: "18-Aug",
      customer: "American Ingredients",
      customerPO: "",
      roNumber: "",
      incoterm: "FOB Mumbai",
      source: "Woods fm F-871",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: true,
      carrierRate: 350,
      transportType: "FTL",
      invoiceNumber: "4812",
      invoiceSent: true,
      pickupDeliveryTracking: "DDP - Picked up & on route",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: true,
    },
    {
      id: "9",
      shipDate: "19-Aug",
      customer: "ICC",
      customerPO: "",
      roNumber: "",
      incoterm: "CFR",
      source: "IGL",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: false,
      carrierRate: null,
      transportType: "",
      invoiceNumber: "4812",
      invoiceSent: true,
      pickupDeliveryTracking: "GWI Confirmed | Carrier Confirmed | Pciked up",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: true,
    },
    {
      id: "10",
      shipDate: "19-Aug",
      customer: "ICC",
      customerPO: "",
      roNumber: "",
      incoterm: "CFR",
      source: "IGL",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: false,
      carrierRate: null,
      transportType: "",
      invoiceNumber: "4812",
      invoiceSent: true,
      pickupDeliveryTracking: "IGL Confirmed | Carrier Confirmed | 08/18 @ 10 AM",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: true,
    },
    {
      id: "11",
      shipDate: "19-Aug",
      customer: "ICC",
      customerPO: "",
      roNumber: "",
      incoterm: "CFR",
      source: "IGL",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: false,
      carrierRate: null,
      transportType: "",
      invoiceNumber: "4812",
      invoiceSent: true,
      pickupDeliveryTracking: "IGL Confirmed | Carrier Confirmed | 08/18 @ 2 PM",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: true,
    },
    {
      id: "12",
      shipDate: "19-Aug",
      customer: "American Ingredients",
      customerPO: "",
      roNumber: "",
      incoterm: "FOB Mumbai",
      source: "Woods fm F-871",
      ocApproval: true,
      pickupInstructionsSent: true,
      plSent: true,
      coaSent: true,
      rfq: true,
      carrierRate: 1370,
      transportType: "FTL",
      invoiceNumber: "4812",
      invoiceSent: true,
      pickupDeliveryTracking: "IGL Confirmed | Carrier Confirmed | 08/19 @ 1 PM | Picked Up",
      attachedDocsOnIGL: false,
      reeferInPUInstructions: false,
      bimboReadables: false,
      pickupBOLSent: true,
    },
  ]

  useEffect(() => {
    // Load sample data
    setLogisticsRecords(sampleData)
    setLoading(false)
  }, [])

  const filteredRecords = logisticsRecords.filter(record => {
    const matchesSearch = 
      record.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.customerPO.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.roNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.source.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Simple date filtering
    let matchesDate = true
    if (selectedDate) {
      const recordDate = new Date(record.shipDate + "-2024") // Assuming current year
      const selected = new Date(selectedDate)
      matchesDate = recordDate.toDateString() === selected.toDateString()
    }
    
    if (filterStatus === "all") return matchesSearch && matchesDate
    if (filterStatus === "pending") return matchesSearch && matchesDate && !record.ocApproval
    if (filterStatus === "approved") return matchesSearch && matchesDate && record.ocApproval
    if (filterStatus === "shipped") return matchesSearch && matchesDate && record.pickupDeliveryTracking.includes("Shipped")
    if (filterStatus === "picked") return matchesSearch && matchesDate && record.pickupDeliveryTracking.includes("Picked")
    
    return matchesSearch && matchesDate
  })

  const handleExportCSV = () => {
    const headers = [
      "Ship Date", "Customer", "Customer PO#", "RO#", "Incoterm", "Source",
      "OC Approval", "Pickup Instructions Sent", "PL Sent", "COA Sent", "RFQ",
      "Carrier Rate", "Transport Type", "Invoice No.", "Invoice Sent",
      "Pickup/Delivery Tracking", "Attached Docs on IGL", "Reefer in PU Instructions",
      "Bimbo Readables", "Pickup BOL Sent"
    ]

    const csvContent = [
      headers.join(","),
      ...filteredRecords.map(record => [
        record.shipDate,
        record.customer,
        record.customerPO,
        record.roNumber,
        record.incoterm,
        record.source,
        record.ocApproval ? "Yes" : "No",
        record.pickupInstructionsSent ? "Yes" : "No",
        record.plSent ? "Yes" : "No",
        record.coaSent ? "Yes" : "No",
        record.rfq ? "Yes" : "No",
        record.carrierRate || "",
        record.transportType,
        record.invoiceNumber || "",
        record.invoiceSent ? "Yes" : "No",
        record.pickupDeliveryTracking,
        record.attachedDocsOnIGL ? "Yes" : "No",
        record.reeferInPUInstructions ? "Yes" : "No",
        record.bimboReadables ? "Yes" : "No",
        record.pickupBOLSent ? "Yes" : "No"
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    
    // Create filename with selected date if date is selected
    let filename = "overseas_tracking"
    if (selectedDate) {
      filename += `_${selectedDate}`
    } else {
      filename += `_${new Date().toISOString().split('T')[0]}`
    }
    filename += ".csv"
    
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const updateRecord = (id: string, field: keyof LogisticsRecord, value: any) => {
    setLogisticsRecords(prev => 
      prev.map(record => 
        record.id === id ? { ...record, [field]: value } : record
      )
    )
  }

  const clearFilters = () => {
    setSearchQuery("")
    setFilterStatus("all")
    setSelectedDate("")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-foreground">Loading Overseas...</div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Overseas Tracking</h1>
          <p className="text-slate-600 text-sm font-medium">Track and manage all your overseas operations</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Total Records</p>
                <p className="text-2xl font-bold text-blue-900">{logisticsRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">OC Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {logisticsRecords.filter(r => r.ocApproval).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Pending Approval</p>
                <p className="text-2xl font-bold text-orange-600">
                  {logisticsRecords.filter(r => !r.ocApproval).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Shipped</p>
                <p className="text-2xl font-bold text-purple-600">
                  {logisticsRecords.filter(r => r.pickupDeliveryTracking.includes("Shipped")).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full max-w-md"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-black">Date:</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Records</SelectItem>
            <SelectItem value="approved">OC Approved</SelectItem>
            <SelectItem value="pending">Pending Approval</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="picked">Picked Up</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          onClick={clearFilters} 
          variant="outline" 
          size="sm"
          className="whitespace-nowrap"
        >
          Clear Filters
        </Button>
      </div>

      {/* Logistics Table - Enhanced for better visibility */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <CardTitle>Overseas Records ({filteredRecords.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto relative">
            <table className="w-full min-w-full border-collapse border border-gray-300">
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="bg-white shadow-sm border-b-2 border-gray-200">
                  <th className="border border-gray-300 p-3 text-left text-sm font-medium text-gray-700 min-w-[100px] bg-white">Ship Date</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-medium text-gray-700 min-w-[120px] bg-white">Customer</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-medium text-gray-700 min-w-[150px] bg-white">Customer PO#</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-medium text-gray-700 min-w-[120px] bg-white">RO#</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-medium text-gray-700 min-w-[80px] bg-white">Incoterm</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-medium text-gray-700 min-w-[100px] bg-white">Source</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[100px] bg-white">OC Approval</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[120px] bg-white">Pickup Instr. Sent</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[80px] bg-white">PL Sent</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[100px] bg-white">COA Sent</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[80px] bg-white">RFQ</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[100px] bg-white">Carrier Rate</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[120px] bg-white">Transport Type</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[100px] bg-white">Invoice No.</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[100px] bg-white">Invoice Sent</th>
                  <th className="border border-gray-300 p-3 text-left text-sm font-medium text-gray-700 min-w-[150px] bg-white">Pickup/Delivery Tracking</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[120px] bg-white">Attached Docs</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[100px] bg-white">Reefer PU</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[120px] bg-white">Bimbo Readables</th>
                  <th className="border border-gray-300 p-3 text-center text-sm font-medium text-gray-700 min-w-[100px] bg-white">Pickup BOL</th>
                </tr>
              </thead>
              <tbody className="relative">
                {filteredRecords.map((record, index) => (
                  <tr 
                    key={record.id} 
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="border border-gray-300 p-3 text-sm">{record.shipDate}</td>
                    <td className="border border-gray-300 p-3 text-sm font-medium">{record.customer}</td>
                    <td className="border border-gray-300 p-3 text-sm">{record.customerPO || "-"}</td>
                    <td className="border border-gray-300 p-3 text-sm">{record.roNumber || "-"}</td>
                    <td className="border border-gray-300 p-3 text-sm">{record.incoterm}</td>
                    <td className="border border-gray-300 p-3 text-sm">{record.source}</td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.ocApproval}
                        onCheckedChange={(checked) => updateRecord(record.id, 'ocApproval', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.pickupInstructionsSent}
                        onCheckedChange={(checked) => updateRecord(record.id, 'pickupInstructionsSent', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.plSent}
                        onCheckedChange={(checked) => updateRecord(record.id, 'plSent', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.coaSent}
                        onCheckedChange={(checked) => updateRecord(record.id, 'coaSent', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.rfq}
                        onCheckedChange={(checked) => updateRecord(record.id, 'rfq', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-center text-sm">
                      {record.carrierRate ? `$${record.carrierRate}` : "-"}
                    </td>
                    <td className="border border-gray-300 p-3 text-center text-sm">{record.transportType || "-"}</td>
                    <td className="border border-gray-300 p-3 text-center text-sm">{record.invoiceNumber || "-"}</td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.invoiceSent}
                        onCheckedChange={(checked) => updateRecord(record.id, 'invoiceSent', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-sm max-w-xs">
                      {record.pickupDeliveryTracking || "-"}
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.attachedDocsOnIGL}
                        onCheckedChange={(checked) => updateRecord(record.id, 'attachedDocsOnIGL', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.reeferInPUInstructions}
                        onCheckedChange={(checked) => updateRecord(record.id, 'reeferInPUInstructions', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.bimboReadables}
                        onCheckedChange={(checked) => updateRecord(record.id, 'bimboReadables', checked)}
                      />
                    </td>
                    <td className="border border-gray-300 p-3 text-center">
                      <Checkbox
                        checked={record.pickupBOLSent}
                        onCheckedChange={(checked) => updateRecord(record.id, 'pickupBOLSent', checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
