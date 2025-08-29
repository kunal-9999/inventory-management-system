"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RotateCcw, Download, Plus, Minus, RotateCw, Search, Edit, X, Check, ArrowUp } from "lucide-react"
import { canUseSupabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Product {
  id: string
  name: string
  description: string
  unit: string
}

interface Customer {
  id: string
  name: string
}

interface Warehouse {
  id: string
  name: string
}

interface ProductRow {
  id: string
  product: { id: string; name: string; unit: string }
  customer: { id: string; name: string }
  warehouse: { id: string; name: string }
  unit: string
  annual_volume: number
  monthly_sales: { [key: string]: number }
  monthly_shipments: { [key: string]: { shipment_number: string; quantity: number }[] }
  monthly_opening_stock: { [key: string]: number }
  monthly_closing_stock: { [key: string]: number }
  opening_stock: number
  closing_stock: number
  total_sales: number
  isEditing?: boolean
  isNew?: boolean
  rowType?: "regular" | "opening_stock"
}

export default function ProductManagement() {
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [undoStack, setUndoStack] = useState<ProductRow[][]>([])
  const [redoStack, setRedoStack] = useState<ProductRow[][]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  const [tableZoomLevel, setTableZoomLevel] = useState(60)
  const selectedYear = new Date().getFullYear()
  const [editingCells, setEditingCells] = useState<Set<string>>(new Set())
  const [currentlyFocusedCell, setCurrentlyFocusedCell] = useState<{ rowIndex: number; field: string } | null>(null)

  const [duplicateAlert, setDuplicateAlert] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<{
    items: string[]
    field: string
    rowIndex: number
    show: boolean
    position: { top: number; left: number }
  }>({
    items: [],
    field: "",
    rowIndex: -1,
    show: false,
    position: { top: 0, left: 0 },
  })

  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  const [editingShipment, setEditingShipment] = useState<{
    rowIndex: number
    monthKey: string
    shipmentNumber: string
    quantity: string
    shipmentIndex?: number
  } | null>(null)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    rowIndex: number
    field: string
    monthKey?: string
  } | null>(null)

  const [cellFormatting, setCellFormatting] = useState<{
    [key: string]: { color: string; bold: boolean }
  }>({})

  const [newlyAddedRowIndex, setNewlyAddedRowIndex] = useState<number | null>(null)

  const contextMenuRef = useRef<HTMLDivElement>(null)

  const months = [
    { key: "dec24", label: "Sales Dec 24", month: 12 },
    { key: "jan25", label: "Sales Jan 25", month: 1 },
    { key: "feb25", label: "Sales Feb 25", month: 2 },
    { key: "mar25", label: "Sales Mar 25", month: 3 },
    { key: "apr25", label: "Sales Apr 25", month: 4 },
    { key: "may25", label: "Sales May 25", month: 5 },
    { key: "jun25", label: "Sales Jun 25", month: 6 },
    { key: "jul25", label: "Sales Jul 25", month: 7 },
    { key: "aug25", label: "Sales Aug 25", month: 8 },
    { key: "sep25", label: "Sales Sep 25", month: 9 },
    { key: "oct25", label: "Sales Oct 25", month: 10 },
    { key: "nov25", label: "Sales Nov 25", month: 11 },
    { key: "dec25", label: "Sales Dec 25", month: 12 },
  ]

  const [filteredRows, setFilteredRows] = useState<ProductRow[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Mock data for demonstration
      const mockProductRows: ProductRow[] = [
        {
          id: "1",
          product: { id: "p1", name: "INGREDIENT A", unit: "Kgs" },
          customer: { id: "c1", name: "Customer Alpha" },
          warehouse: { id: "w1", name: "WAREHOUSE NORTH" },
          unit: "Kgs",
          annual_volume: 50000,
          monthly_sales: {
            "dec24": 1000, // Dec sales as per your example
            "jan25": 1350,
            "feb25": 1100,
            "mar25": 1400,
            "apr25": 1250,
            "may25": 1300,
            "jun25": 1150,
            "jul25": 1450,
            "aug25": 1200,
            "sep25": 1350,
            "oct25": 1100,
            "nov25": 1250,
            "dec25": 1400
          },
          monthly_shipments: {
            "dec24": [
              { shipment_number: "SH-001", quantity: 24000 } // Total shipment quantity as per your example
            ],
            "jan25": [
              { shipment_number: "SH-003", quantity: 1200 },
              { shipment_number: "SH-004", quantity: 900 }
            ],
            "feb25": [
              { shipment_number: "SH-005", quantity: 1000 }
            ],
            "mar25": [
              { shipment_number: "SH-006", quantity: 1400 },
              { shipment_number: "SH-007", quantity: 600 }
            ],
            "apr25": [
              { shipment_number: "SH-008", quantity: 1100 }
            ],
            "may25": [
              { shipment_number: "SH-009", quantity: 1300 }
            ],
            "jun25": [
              { shipment_number: "SH-010", quantity: 1000 },
              { shipment_number: "SH-011", quantity: 500 }
            ],
            "jul25": [
              { shipment_number: "SH-012", quantity: 1200 }
            ],
            "aug25": [
              { shipment_number: "SH-013", quantity: 1000 }
            ],
            "sep25": [
              { shipment_number: "SH-014", quantity: 1200 }
            ],
            "oct25": [
              { shipment_number: "SH-015", quantity: 900 }
            ],
            "nov25": [
              { shipment_number: "SH-016", quantity: 1100 }
            ],
            "dec25": [
              { shipment_number: "SH-017", quantity: 1300 }
            ]
          },
          monthly_opening_stock: {
            "dec24": 10000, // Starting opening stock as per your example
            // Expected calculation: Dec closing stock = 10000 + 24000 - 1000 = 33000
            // Jan opening stock should auto-calculate to 33000
          },
          monthly_closing_stock: {
            "dec24": 33000, // 10000 + 24000 - 1000
            "jan25": 32150, // 33000 + 2100 - 1350
            "feb25": 32150, // 32150 + 1000 - 1100
            "mar25": 32150, // 32150 + 2000 - 1400
            "apr25": 32000, // 32150 + 1100 - 1250
            "may25": 32000, // 32000 + 1300 - 1300
            "jun25": 31850, // 32000 + 1500 - 1150
            "jul25": 31900, // 31850 + 1200 - 1450
            "aug25": 31800, // 31900 + 1000 - 1200
            "sep25": 31850, // 31800 + 1200 - 1350
            "oct25": 31850, // 31850 + 900 - 1100
            "nov25": 31800, // 31850 + 1100 - 1250
            "dec25": 31650  // 31800 + 1300 - 1400
          },
          opening_stock: 5000,
          closing_stock: 4700,
          total_sales: 15000,
          isEditing: false,
          isNew: false
        },
        {
          id: "2",
          product: { id: "p1", name: "INGREDIENT A", unit: "Kgs" },
          customer: { id: "c2", name: "Customer Beta" },
          warehouse: { id: "w1", name: "WAREHOUSE NORTH" },
          unit: "Kgs",
          annual_volume: 30000,
          monthly_sales: {
            "dec24": 800,
            "jan25": 900,
            "feb25": 750,
            "mar25": 950,
            "apr25": 850,
            "may25": 900,
            "jun25": 800,
            "jul25": 1000,
            "aug25": 850,
            "sep25": 950,
            "oct25": 800,
            "nov25": 900,
            "dec25": 950
          },
          monthly_shipments: {
            "dec24": [
              { shipment_number: "SH-018", quantity: 1000 }
            ],
            "jan25": [
              { shipment_number: "SH-019", quantity: 900 }
            ],
            "feb25": [
              { shipment_number: "SH-020", quantity: 800 }
            ],
            "mar25": [
              { shipment_number: "SH-021", quantity: 1000 }
            ],
            "apr25": [
              { shipment_number: "SH-022", quantity: 900 }
            ],
            "may25": [
              { shipment_number: "SH-023", quantity: 950 }
            ],
            "jun25": [
              { shipment_number: "SH-024", quantity: 850 }
            ],
            "jul25": [
              { shipment_number: "SH-025", quantity: 1000 }
            ],
            "aug25": [
              { shipment_number: "SH-026", quantity: 900 }
            ],
            "sep25": [
              { shipment_number: "SH-027", quantity: 950 }
            ],
            "oct25": [
              { shipment_number: "SH-028", quantity: 800 }
            ],
            "nov25": [
              { shipment_number: "SH-029", quantity: 900 }
            ],
            "dec25": [
              { shipment_number: "SH-030", quantity: 950 }
            ]
          },
          monthly_opening_stock: {
            "dec24": 3000,
            "jan25": 3200,
            "feb25": 3200,
            "mar25": 3250,
            "apr25": 3300,
            "may25": 3250,
            "jun25": 3200,
            "jul25": 3150,
            "aug25": 3150,
            "sep25": 3100,
            "oct25": 3100,
            "nov25": 3000,
            "dec25": 3100
          },
          monthly_closing_stock: {
            "dec24": 3200, // 3000 + 1000 - 800
            "jan25": 3200, // 3200 + 900 - 900
            "feb25": 3250, // 3200 + 800 - 750
            "mar25": 3300, // 3250 + 1000 - 950
            "apr25": 3350, // 3300 + 900 - 850
            "may25": 3400, // 3350 + 950 - 900
            "jun25": 3400, // 3400 + 850 - 800
            "jul25": 3450, // 3400 + 1000 - 1000
            "aug25": 3500, // 3450 + 900 - 850
            "sep25": 3550, // 3500 + 950 - 950
            "oct25": 3550, // 3550 + 800 - 800
            "nov25": 3600, // 3550 + 900 - 900
            "dec25": 3650  // 3600 + 950 - 950
          },
          opening_stock: 3000,
          closing_stock: 3100,
          total_sales: 10500,
          isEditing: false,
          isNew: false
        },
        {
          id: "3",
          product: { id: "p2", name: "INGREDIENT B", unit: "Kgs" },
          customer: { id: "c3", name: "Customer Gamma" },
          warehouse: { id: "w2", name: "WAREHOUSE SOUTH" },
          unit: "Kgs",
          annual_volume: 40000,
          monthly_sales: {
            "dec24": 1000,
            "jan25": 1100,
            "feb25": 950,
            "mar25": 1150,
            "apr25": 1050,
            "may25": 1100,
            "jun25": 1000,
            "jul25": 1200,
            "aug25": 1050,
            "sep25": 1150,
            "oct25": 1000,
            "nov25": 1100,
            "dec25": 1150
          },
          monthly_shipments: {
            "dec24": [
              { shipment_number: "SH-031", quantity: 1200 }
            ],
            "jan25": [
              { shipment_number: "SH-032", quantity: 1100 }
            ],
            "feb25": [
              { shipment_number: "SH-033", quantity: 1000 }
            ],
            "mar25": [
              { shipment_number: "SH-034", quantity: 1200 }
            ],
            "apr25": [
              { shipment_number: "SH-035", quantity: 1100 }
            ],
            "may25": [
              { shipment_number: "SH-036", quantity: 1150 }
            ],
            "jun25": [
              { shipment_number: "SH-037", quantity: 1050 }
            ],
            "jul25": [
              { shipment_number: "SH-038", quantity: 1200 }
            ],
            "aug25": [
              { shipment_number: "SH-039", quantity: 1100 }
            ],
            "sep25": [
              { shipment_number: "SH-040", quantity: 1150 }
            ],
            "oct25": [
              { shipment_number: "SH-041", quantity: 1000 }
            ],
            "nov25": [
              { shipment_number: "SH-042", quantity: 1100 }
            ],
            "dec25": [
              { shipment_number: "SH-043", quantity: 1150 }
            ]
          },
          monthly_opening_stock: {
            "dec24": 4000,
            "jan25": 4200,
            "feb25": 4250,
            "mar25": 4300,
            "apr25": 4350,
            "may25": 4400,
            "jun25": 4350,
            "jul25": 4300,
            "aug25": 4250,
            "sep25": 4200,
            "oct25": 4150,
            "nov25": 4100,
            "dec25": 4050
          },
          monthly_closing_stock: {},
          opening_stock: 4000,
          closing_stock: 4050,
          total_sales: 13000,
          isEditing: false,
          isNew: false
        },
        {
          id: "4",
          product: { id: "p3", name: "INGREDIENT C", unit: "Lbs" },
          customer: { id: "c4", name: "Customer Delta" },
          warehouse: { id: "w3", name: "WAREHOUSE EAST" },
          unit: "Lbs",
          annual_volume: 25000,
          monthly_sales: {
            "dec24": 600,
            "jan25": 650,
            "feb25": 600,
            "mar25": 700,
            "apr25": 650,
            "may25": 700,
            "jun25": 600,
            "jul25": 750,
            "aug25": 650,
            "sep25": 700,
            "oct25": 600,
            "nov25": 650,
            "dec25": 700
          },
          monthly_shipments: {
            "dec24": [
              { shipment_number: "SH-044", quantity: 800 }
            ],
            "jan25": [
              { shipment_number: "SH-045", quantity: 700 }
            ],
            "feb25": [
              { shipment_number: "SH-046", quantity: 650 }
            ],
            "mar25": [
              { shipment_number: "SH-047", quantity: 750 }
            ],
            "apr25": [
              { shipment_number: "SH-048", quantity: 700 }
            ],
            "may25": [
              { shipment_number: "SH-049", quantity: 750 }
            ],
            "jun25": [
              { shipment_number: "SH-050", quantity: 650 }
            ],
            "jul25": [
              { shipment_number: "SH-051", quantity: 800 }
            ],
            "aug25": [
              { shipment_number: "SH-052", quantity: 700 }
            ],
            "sep25": [
              { shipment_number: "SH-053", quantity: 750 }
            ],
            "oct25": [
              { shipment_number: "SH-054", quantity: 650 }
            ],
            "nov25": [
              { shipment_number: "SH-055", quantity: 700 }
            ],
            "dec25": [
              { shipment_number: "SH-056", quantity: 750 }
            ]
          },
          monthly_opening_stock: {
            "dec24": 2000,
            "jan25": 2200,
            "feb25": 2250,
            "mar25": 2300,
            "apr25": 2350,
            "may25": 2400,
            "jun25": 2350,
            "jul25": 2300,
            "aug25": 2250,
            "sep25": 2200,
            "oct25": 2150,
            "nov25": 2100,
            "dec25": 2050
          },
          monthly_closing_stock: {},
          opening_stock: 2000,
          closing_stock: 2050,
          total_sales: 8000,
          isEditing: false,
          isNew: false
        }
      ]

      const mockCustomers: Customer[] = [
        { id: "c1", name: "Customer Alpha" },
        { id: "c2", name: "Customer Beta" },
        { id: "c3", name: "Customer Gamma" },
        { id: "c4", name: "Customer Delta" }
      ]

      const mockWarehouses: Warehouse[] = [
        { id: "w1", name: "WAREHOUSE NORTH" },
        { id: "w2", name: "WAREHOUSE SOUTH" },
        { id: "w3", name: "WAREHOUSE EAST" }
      ]

      setProductRows(mockProductRows)
      setCustomers(mockCustomers)
      setWarehouses(mockWarehouses)
      
      // Save to localStorage so other tabs can access this data
      localStorage.setItem('inventoryProductData', JSON.stringify(mockProductRows))
      localStorage.setItem('inventoryCustomerData', JSON.stringify(mockCustomers))
      localStorage.setItem('inventoryWarehouseData', JSON.stringify(mockWarehouses))
      
      // Calculate stock values for the mock data
      setTimeout(() => {
        calculateStockValues(mockProductRows)
      }, 100)
      
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // First try to load data from localStorage
    const storedData = localStorage.getItem('inventoryProductData')
    const storedCustomers = localStorage.getItem('inventoryCustomerData')
    const storedWarehouses = localStorage.getItem('inventoryWarehouseData')
    
    if (storedData && storedCustomers && storedWarehouses) {
      try {
        const parsedData = JSON.parse(storedData)
        const parsedCustomers = JSON.parse(storedCustomers)
        const parsedWarehouses = JSON.parse(storedWarehouses)
        
        console.log('[ProductManagement] Restoring data from localStorage:', {
          productRows: parsedData.length,
          customers: parsedCustomers.length,
          warehouses: parsedWarehouses.length
        })
        
        setProductRows(parsedData)
        setCustomers(parsedCustomers)
        setWarehouses(parsedWarehouses)
        setLoading(false)
        
        // Calculate stock values for restored data - use a simple calculation here
        // since calculateStockValues is defined later in the component
        const updatedRows = parsedData.map((row: any) => {
          if (!row || !row.monthly_sales || !row.monthly_shipments || !row.monthly_opening_stock) {
            return row
          }
          
          const updatedRow = { ...row }
          
          // Simple stock calculation for restored data
          months.forEach((month, monthIndex) => {
            const monthKey = month.key
            const openingStock = updatedRow.monthly_opening_stock[monthKey] || 0
            const sales = updatedRow.monthly_sales[monthKey] || 0
            const shipments = updatedRow.monthly_shipments[monthKey] || []
            const totalShipmentQuantity = shipments.reduce((sum: number, shipment: any) => sum + (shipment.quantity || 0), 0)
            
            // Calculate closing stock: Opening Stock + Shipments - Sales
            const closingStock = openingStock + totalShipmentQuantity - sales
            updatedRow.monthly_closing_stock[monthKey] = closingStock
            
            // Carry forward closing stock to next month's opening stock
            if (monthIndex < months.length - 1) {
              const nextMonthKey = months[monthIndex + 1].key
              if (updatedRow.isNew) {
                updatedRow.monthly_opening_stock[nextMonthKey] = closingStock
              } else {
                const currentOpeningStock = updatedRow.monthly_opening_stock[nextMonthKey]
                if (currentOpeningStock === undefined || currentOpeningStock === 0) {
                  updatedRow.monthly_opening_stock[nextMonthKey] = closingStock
                }
              }
            }
          })
          
          return updatedRow
        })
        
        setProductRows(updatedRows)
        
        return
      } catch (error) {
        console.error('[ProductManagement] Error parsing stored data:', error)
      }
    }
    
    // If no stored data or error, fetch fresh data
    fetchData()
  }, [selectedYear])

  // Save initial state to undo stack when data is first loaded
  useEffect(() => {
    if (productRows.length > 0 && undoStack.length === 0) {
      console.log("[v0] Saving initial state to undo stack")
      setUndoStack([JSON.parse(JSON.stringify(productRows))])
    }
  }, [productRows, undoStack.length])

  useEffect(() => {
    // Apply search filter whenever searchQuery or productRows change
    const lowerSearchQuery = searchQuery.toLowerCase()
    const newFilteredRows = productRows.filter((row) => {
      if (!searchQuery.trim()) return true
      const lowerSearchQuery = searchQuery.toLowerCase()
      return (
        row.product?.name?.toLowerCase().includes(lowerSearchQuery) ||
        row.customer?.name?.toLowerCase().includes(lowerSearchQuery) ||
        row.warehouse?.name?.toLowerCase().includes(lowerSearchQuery)
      )
    })
    setFilteredRows(newFilteredRows)
  }, [searchQuery, productRows])

  useEffect(() => {
    // Update localStorage whenever productRows changes so other tabs can access updated data
    if (productRows.length > 0) {
      console.log('[ProductManagement] productRows changed, length:', productRows.length)
      localStorage.setItem('inventoryProductData', JSON.stringify(productRows))
      // Dispatch custom event to notify other components in the same window
      console.log('[ProductManagement] Dispatching localStorageChange event, productRows length:', productRows.length)
      const event = new Event('localStorageChange')
      window.dispatchEvent(event)
      console.log('[ProductManagement] Event dispatched successfully')
    }
  }, [productRows])

  // Listen for localStorage changes from other components
  useEffect(() => {
    const handleLocalStorageChange = () => {
      console.log('[ProductManagement] Received localStorageChange event, checking for updates...')
      const storedData = localStorage.getItem('inventoryProductData')
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData)
          // Only update if the data is different to avoid infinite loops
          if (JSON.stringify(parsedData) !== JSON.stringify(productRows)) {
            console.log('[ProductManagement] Updating from localStorage event, new length:', parsedData.length)
            setProductRows(parsedData)
          }
        } catch (error) {
          console.error('[ProductManagement] Error parsing data from event:', error)
        }
      }
    }

    window.addEventListener('localStorageChange', handleLocalStorageChange)
    
    return () => {
      window.removeEventListener('localStorageChange', handleLocalStorageChange)
    }
  }, [productRows])

  const groupProductsByName = (rows: ProductRow[], updatedRowIndex: number, newProductName: string) => {
    if (!newProductName.trim()) return rows

    const updatedRow = { ...rows[updatedRowIndex], product: { ...rows[updatedRowIndex].product, name: newProductName } }
    const otherRows = rows.filter((_, index) => index !== updatedRowIndex)

    // Find if this product already exists (regardless of warehouse)
    const existingProductIndex = otherRows.findIndex(
      (row) => row.product.name.toLowerCase() === newProductName.toLowerCase(),
    )

    if (existingProductIndex === -1) {
      // Product doesn't exist, add at the end
      return [...otherRows, updatedRow]
    } else {
      // Product exists, find the last occurrence and insert after it
      let lastOccurrenceIndex = -1
      for (let i = otherRows.length - 1; i >= 0; i--) {
        if (otherRows[i].product.name.toLowerCase() === newProductName.toLowerCase()) {
          lastOccurrenceIndex = i
          break
        }
      }

      // Insert the updated row after the last occurrence
      const newRows = [...otherRows]
      newRows.splice(lastOccurrenceIndex + 1, 0, updatedRow)
      return newRows
    }
  }

  const groupProductsByNameAndWarehouse = (rows: ProductRow[], newProductName: string, targetWarehouse: string) => {
    if (!newProductName?.trim() || !targetWarehouse?.trim()) return rows

    const updatedRows = [...rows]
    const otherRows = updatedRows.slice()

    // Find if this product already exists (regardless of warehouse)
    const existingProductIndex = otherRows.findIndex(
      (row) => row?.product?.name?.toLowerCase() === newProductName.toLowerCase(),
    )

    if (existingProductIndex === -1) {
      return updatedRows
    }

    // Find the target position for the new entry
    let targetIndex = -1
    for (let i = 0; i < otherRows.length; i++) {
      const row = otherRows[i]
      if (!row?.product?.name || !row?.warehouse?.name) continue

      if (
        row.product.name.toLowerCase() === newProductName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === targetWarehouse.toLowerCase()
      ) {
        targetIndex = i + 1
        break
      }
    }

    if (targetIndex === -1) {
      // Find the last occurrence of this product name
      for (let i = otherRows.length - 1; i >= 0; i--) {
        const row = otherRows[i]
        if (row?.product?.name?.toLowerCase() === newProductName.toLowerCase()) {
          targetIndex = i + 1
          break
        }
      }
    }

    return updatedRows
  }

  const groupByWarehouseChange = (rows: ProductRow[], updatedRowIndex: number, newWarehouseName: string) => {
    if (!newWarehouseName.trim()) return rows

    const updatedRow = {
      ...rows[updatedRowIndex],
      warehouse: { ...rows[updatedRowIndex].warehouse, name: newWarehouseName },
    }
    const otherRows = rows.filter((_, index) => index !== updatedRowIndex)

    const productName = updatedRow.product.name

    // Find if this product-warehouse combination already exists
    const existingIndex = otherRows.findIndex(
      (row) =>
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === newWarehouseName.toLowerCase(),
    )

    if (existingIndex === -1) {
      return [...otherRows, updatedRow]
    } else {
      // Find the last occurrence and insert after it
      let lastOccurrenceIndex = -1
      for (let i = otherRows.length - 1; i >= 0; i--) {
        if (
          otherRows[i].product.name.toLowerCase() === productName.toLowerCase() &&
          otherRows[i].warehouse.name.toLowerCase() === newWarehouseName.toLowerCase()
        ) {
          lastOccurrenceIndex = i
          break
        }
      }

      const newRows = [...otherRows]
      newRows.splice(lastOccurrenceIndex + 1, 0, updatedRow)
      return newRows
    }
  }

  const groupRowsByProductWarehouse = useCallback((rows: ProductRow[]) => {
    if (!Array.isArray(rows)) {
      console.log("[v0] groupRowsByProductWarehouse called with non-array:", rows)
      return {}
    }

    return rows.reduce((groups: { [key: string]: ProductRow[] }, row) => {
      // Skip rows with undefined product or warehouse, but allow empty strings
      if (
        !row ||
        row.product === undefined ||
        row.warehouse === undefined ||
        row.product === null ||
        row.warehouse === null
      ) {
        console.log("[v0] Skipping row with undefined product or warehouse:", row)
        return groups
      }

      const productName = row.product.name || ""
      const warehouseName = row.warehouse.name || ""
      const key = `${productName}-${warehouseName}`

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(row)
      return groups
    }, {})
  }, [])

  const calculateConsolidatedStock = (groupRows: ProductRow[]) => {
    const consolidatedOpeningStock: { [key: string]: number } = {}
    const consolidatedClosingStock: { [key: string]: number } = {}

    months.forEach(({ key }) => {
      // Sum opening stock from all rows in the group with null checks
      consolidatedOpeningStock[key] = groupRows.reduce((sum, row) => {
        if (!row || !row.monthly_opening_stock) return sum
        return sum + (row.monthly_opening_stock[key] || 0)
      }, 0)

      // Sum closing stock from all rows in the group with null checks
      consolidatedClosingStock[key] = groupRows.reduce((sum, row) => {
        if (!row || !row.monthly_closing_stock) return sum
        return sum + (row.monthly_closing_stock[key] || 0)
      }, 0)
    })

    return { consolidatedOpeningStock, consolidatedClosingStock }
  }

  const updateGroupOpeningStock = (productName: string, warehouseName: string, monthKey: string, value: string) => {
    const numValue = Number.parseFloat(value) || 0

    console.log("[v0] Updating group opening stock, saving current state to undo stack")
    saveToUndoStack(productRows)

    const updatedRows = productRows.map((row) => {
      if (
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
      ) {
        return {
          ...row,
          monthly_opening_stock: {
            ...row.monthly_opening_stock,
            [monthKey]: numValue,
          },
        }
      }
      return row
    })

    // Recalculate closing stock for affected rows using the new formula
    const calculateStockForRow = (rows: ProductRow[], rowIndex: number) => {
      const row = rows[rowIndex]

      // Calculate closing stock for each month and carry forward to next month
      months.forEach((month, monthIndex) => {
        const currentMonthKey = month.key

        // Get values for calculation
        const openingStock = row.monthly_opening_stock[currentMonthKey] || 0
        const sales = row.monthly_sales[currentMonthKey] || 0

        // Calculate total shipment quantity for this month
        const shipments = row.monthly_shipments[currentMonthKey] || []
        const totalShipmentQuantity = shipments.reduce((sum, shipment) => sum + shipment.quantity, 0)

        // Calculate closing stock: Opening Stock + Shipments - Sales
        const closingStock = openingStock + totalShipmentQuantity - sales
        row.monthly_closing_stock[currentMonthKey] = closingStock

        // Carry forward closing stock to next month's opening stock
        if (monthIndex < months.length - 1) {
          const nextMonthKey = months[monthIndex + 1].key
          // For new products, always carry forward to ensure proper chain
          // For existing products, only carry forward if not manually set
          if (row.isNew) {
            row.monthly_opening_stock[nextMonthKey] = closingStock
          } else {
            const currentOpeningStock = row.monthly_opening_stock[nextMonthKey]
            if (currentOpeningStock === undefined || currentOpeningStock === 0) {
              row.monthly_opening_stock[nextMonthKey] = closingStock
            }
          }
        }
      })
    }

    updatedRows.forEach((row, rowIndex) => {
      if (
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
      ) {
        calculateStockForRow(updatedRows, rowIndex)
      }
    })

    setProductRows(updatedRows)
  }

  // This useEffect was removed to prevent duplicate data fetching

  useEffect(() => {
    // Auto-focus on the product name field of newly added rows
    if (newlyAddedRowIndex !== null) {
      // Set editing state for the product name cell
      const newEditingCells = new Set(editingCells)
      newEditingCells.add(`${newlyAddedRowIndex}-product.name`)
      setEditingCells(newEditingCells)
      setCurrentlyFocusedCell({ rowIndex: newlyAddedRowIndex, field: "product.name" })

      // Focus the input element after a short delay to ensure it's rendered
      setTimeout(() => {
        const inputElement = document.querySelector(
          `input[data-row="${newlyAddedRowIndex}"][data-field="product.name"]`,
        ) as HTMLInputElement
        if (inputElement) {
          inputElement.focus()
        }
      }, 100)

      // Reset the newly added row index
      setNewlyAddedRowIndex(null)
    }
  }, [newlyAddedRowIndex, editingCells])

  const saveToUndoStack = useCallback((currentRows: ProductRow[]) => {
    // Ensure currentRows is an array
    if (!Array.isArray(currentRows)) {
      console.log("[v0] saveToUndoStack called with non-array:", currentRows)
      return
    }

    console.log("[v0] saveToUndoStack called with", currentRows.length, "rows")

    setUndoStack((prevStack) => {
      if (prevStack.length >= 20) {
        console.log("[v0] Undo stack at maximum capacity, removing oldest entry")
        const newStack = prevStack.slice(1) // Remove oldest entry
        newStack.push(JSON.parse(JSON.stringify(currentRows)))
        console.log("[v0] Saved to undo stack, stack length:", newStack.length)
        return newStack
      }

      // Check if this is a duplicate of the last saved state
      if (prevStack.length > 0) {
        const lastSaved = prevStack[prevStack.length - 1]
        if (JSON.stringify(lastSaved) === JSON.stringify(currentRows)) {
          console.log("[v0] Duplicate state detected, skipping save")
          return prevStack
        }
      }

      const newStack = [...prevStack, JSON.parse(JSON.stringify(currentRows))]
      console.log("[v0] Saved to undo stack, stack length:", newStack.length)
      return newStack
    })

    // Clear redo stack when new action is performed
    setRedoStack([])
  }, [])

  const calculateStockValues = useCallback((rows: ProductRow[]) => {
    // Stock Calculation Logic:
    // 1. Closing Stock = Opening Stock + Total Shipments - Sales
    // 2. Next month's Opening Stock = Previous month's Closing Stock (auto-calculated)
    // 3. Manual opening stock entries override auto-calculation
    // 
    // Example: Dec sales = 1000, shipments = 24000, opening stock = 10000
    // Closing stock = 10000 + 24000 - 1000 = 33000
    // Jan opening stock = 33000 (auto-calculated)
    
    // Ensure rows is an array before proceeding
    if (!Array.isArray(rows)) {
      console.log("[v0] calculateStockValues called with non-array:", rows)
      return []
    }

    const updatedRows = rows.map((row) => {
      // Skip calculation if essential data is missing, but allow empty strings
      if (
        !row ||
        !row.monthly_sales ||
        !row.monthly_shipments ||
        !row.monthly_opening_stock ||
        !row.monthly_closing_stock ||
        row.monthly_sales === undefined ||
        row.monthly_shipments === undefined ||
        row.monthly_opening_stock === undefined ||
        row.monthly_closing_stock === undefined
      ) {
        console.log("[v0] Skipping row with undefined monthly data:", row)
        return row
      }

      const updatedRow = { ...row }

      // Calculate closing stock for each month using the formula: Closing Stock = Opening Stock + Shipments - Sales
      months.forEach((month, monthIndex) => {
        const monthKey = month.key
        
        // Get opening stock for this month
        const openingStock = updatedRow.monthly_opening_stock[monthKey] || 0
        
        // Get sales for this month
        const sales = updatedRow.monthly_sales[monthKey] || 0
        
        // Calculate total shipment quantity for this month
        const shipments = updatedRow.monthly_shipments[monthKey] || []
        const totalShipmentQuantity = shipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
        
        // Calculate closing stock: Opening Stock + Shipments - Sales
        const closingStock = openingStock + totalShipmentQuantity - sales
        updatedRow.monthly_closing_stock[monthKey] = closingStock
        
        // Carry forward closing stock to next month's opening stock
        if (monthIndex < months.length - 1) {
          const nextMonthKey = months[monthIndex + 1].key
          // For new products, always carry forward to ensure proper chain
          // For existing products, only carry forward if not manually set
          if (updatedRow.isNew) {
            updatedRow.monthly_opening_stock[nextMonthKey] = closingStock
          } else {
            const currentOpeningStock = updatedRow.monthly_opening_stock[nextMonthKey]
            if (currentOpeningStock === undefined || currentOpeningStock === 0) {
              updatedRow.monthly_opening_stock[nextMonthKey] = closingStock
            }
          }
        }
      })

      return updatedRow
    })

    console.log("[v0] calculateStockValues completed, calling setProductRows")
    // Don't trigger undo save for automatic calculations
    setProductRows(updatedRows)
    return updatedRows
  }, [])

  const updateCellValue = useCallback(
    (rowIndex: number, field: string, value: string) => {
      const oldValue = productRows[rowIndex]?.[field as keyof ProductRow]

      // Only save to undo stack if value actually changed
      if (oldValue !== value) {
        console.log("[v0] Value changed, saving to undo stack:", { field, oldValue, newValue: value })
        saveToUndoStack(productRows)
      }

      const updatedRows = [...productRows]
      const row = updatedRows[rowIndex]

      if (!row) return

      if (field === "product.name") {
        row.product.name = value.toUpperCase()
        const groupedRows = groupProductsByNameAndWarehouse(updatedRows, value, row.warehouse.name)
        setProductRows(groupedRows)

        // Check for duplicates after a short delay to allow state to update
        setTimeout(() => {
          checkForDuplicates(value, row.customer.name, rowIndex)
        }, 100)
        return
      } else if (field === "customer.name") {
        row.customer.name = value
        checkForDuplicates(row.product.name, value, rowIndex)
        const groupedRows = groupProductsByNameAndWarehouse(updatedRows, row.product.name, row.warehouse.name)
        setProductRows(groupedRows)
        return
      } else if (field === "warehouse.name") {
        row.warehouse.name = value.toUpperCase()
        const groupedRows = groupProductsByNameAndWarehouse(updatedRows, row.product.name, value)
        setProductRows(groupedRows)
        return
      } else if (field.startsWith("monthly_sales.")) {
        const monthKey = field.split(".")[1]
        row.monthly_sales[monthKey] = Number.parseFloat(value) || 0
      } else if (field.startsWith("monthly_opening_stock.")) {
        const monthKey = field.split(".")[1]
        row.monthly_opening_stock[monthKey] = Number.parseFloat(value) || 0
      }

      setProductRows(updatedRows)

      if (field.startsWith("monthly_sales.") || field.startsWith("monthly_opening_stock.")) {
        // Use a single setTimeout to prevent multiple calculations
        setTimeout(() => {
          calculateStockValues(updatedRows)
        }, 50)
      }
    },
    [productRows, saveToUndoStack, calculateStockValues],
  )

  const getCurrentFieldValue = (rowIndex: number, field: string): string => {
    const row = productRows[rowIndex]
    if (!row) return ""

    if (field === "product.name") return row.product.name
    if (field === "customer.name") return row.customer.name
    if (field === "warehouse.name") return row.warehouse.name
    if (field === "annual_volume") return row.annual_volume.toString()
    if (field.startsWith("monthly_sales.")) {
      const monthKey = field.split(".")[1]
      return (row.monthly_sales[monthKey] || 0).toString()
    }
    return ""
  }

  const handleAddProduct = () => {
    const newProductId = `temp-${Date.now()}`
    const firstMonthKey = months[0]?.key || "dec24"
    
    const newRow: ProductRow = {
      id: newProductId,
      product: { id: newProductId, name: "", description: "", unit: "Kgs" },
      customer: { id: "", name: "" },
      warehouse: { id: "", name: "" },
      unit: "Kgs",
      annual_volume: 0,
      monthly_sales: {},
      monthly_shipments: {
        // Add a default shipment so the product appears in shipments tab immediately
        [firstMonthKey]: [
          {
            shipment_number: `SH-${Date.now()}`,
            quantity: 1000
          }
        ]
      },
      monthly_opening_stock: {
        // Set initial opening stock for the first month to enable proper calculations
        // Users can modify this value as needed
        [firstMonthKey]: 1000
        // Don't set values for other months - let the carry-forward logic handle them
      },
      monthly_closing_stock: {},
      opening_stock: 0,
      closing_stock: 0,
      total_sales: 0,
      isEditing: false,
      isNew: true,
    }

    console.log("[v0] Adding new product, saving current state to undo stack")
    saveToUndoStack(productRows)
    const updatedRows = [...productRows, newRow]
    
    // First set the state
    setProductRows(updatedRows)
    
    // Then calculate stock values after state update
    setTimeout(() => {
      calculateStockValues(updatedRows)
    }, 100)

    // Auto-focus on the new row
    setNewlyAddedRowIndex(productRows.length)
  }

  const handleAddToColumn = (columnType: string, monthKey?: string) => {
    if (columnType === "customer.name") {
      console.log("[v0] Customer + button clicked")
      console.log("[v0] Currently focused cell:", currentlyFocusedCell)

      if (!currentlyFocusedCell || currentlyFocusedCell.field !== "product.name") {
        alert("Please click in a Product Name cell first, then click the + button for Customer Name.")
        return
      }

      const focusedRowIndex = currentlyFocusedCell.rowIndex
      const selectedRow = filteredRows[focusedRowIndex]
      console.log("[v0] Selected row data:", selectedRow)

      if (!selectedRow) {
        console.log("[v0] Selected row not found in filtered results")
        alert("Selected row not found. Please click in a Product Name cell again.")
        setCurrentlyFocusedCell(null)
        return
      }

      console.log("[v0] Creating new customer row for product:", selectedRow.product.name)

      const newRow: ProductRow = {
        id: `temp-${Date.now()}`,
        product: selectedRow.product, // Copy the same product
        customer: { id: "", name: "" }, // New empty customer
        warehouse: { id: "", name: "" }, // New empty warehouse
        unit: selectedRow.unit,
        annual_volume: 0,
        monthly_sales: {}, // Initialize empty monthly sales
        monthly_shipments: {
          // Add a default shipment so the product appears in shipments tab immediately
          [months[0]?.key || "dec24"]: [
            {
              shipment_number: `SH-${Date.now()}`,
              quantity: 1000
            }
          ]
        }, // Initialize with first month opening stock
        monthly_opening_stock: {
          // Set initial opening stock for the first month to enable proper calculations
          // Users can modify this value as needed
          [months[0]?.key || "dec24"]: 1000
          // Don't set values for other months - let the carry-forward logic handle them
        }, // Initialize with first month opening stock
        monthly_closing_stock: {}, // Initialize empty monthly closing stock
        opening_stock: 0,
        closing_stock: 0,
        total_sales: 0,
        isEditing: false,
        isNew: true,
      }

      saveToUndoStack(productRows)
      const updatedRows = [...productRows, newRow]

      // Apply grouping to ensure proper positioning
      const groupedRows = groupProductsByNameAndWarehouse(updatedRows, selectedRow.product.name, "")
      setProductRows(groupedRows)

      // Apply calculations to the new row
      setTimeout(() => {
        calculateStockValues(groupedRows)
      }, 0)

      setCurrentlyFocusedCell(null)
    }
  }

  const isCellEditing = (rowIndex: number, field: string) => {
    return editingCells.has(`${rowIndex}-${field}`)
  }

  const stopCellEditing = (rowIndex: number, field: string) => {
    const newEditingCells = new Set(editingCells)
    newEditingCells.delete(`${rowIndex}-${field}`)
    setEditingCells(newEditingCells)
  }

  const stopAllCellEditing = () => {
    setEditingCells(new Set())
  }

  const toggleEdit = (rowIndex: number) => {
    const updatedRows = [...productRows]
    updatedRows[rowIndex].isEditing = !updatedRows[rowIndex].isEditing
    setProductRows(updatedRows)
  }

  const saveRow = (rowIndex: number) => {
    // Find the actual row in productRows that corresponds to the filtered row
    const rowToSave = filteredRows[rowIndex]
    const actualRowIndex = productRows.findIndex(row => 
      row.id === rowToSave.id || 
      (row.product.id === rowToSave.product.id && 
       row.customer.id === rowToSave.customer.id && 
       row.warehouse.id === rowToSave.warehouse.id)
    )
    
    if (actualRowIndex === -1) return
    
    const updatedRows = [...productRows]
    const row = updatedRows[actualRowIndex]
    row.isEditing = false
    row.isNew = false
    
    // If this row has a product name, reposition it to group with rows having the same product name
    if (row.product.name.trim()) {
      // Remove the row from its current position
      const rowToMove = updatedRows.splice(actualRowIndex, 1)[0]
      
      // Find the last row with the same product name
      let insertIndex = updatedRows.length // Default to end if no match found
      for (let i = updatedRows.length - 1; i >= 0; i--) {
        if (updatedRows[i].product.name.toLowerCase() === rowToMove.product.name.toLowerCase()) {
          insertIndex = i + 1
          break
        }
      }
      
      // Insert the row at the correct position
      updatedRows.splice(insertIndex, 0, rowToMove)
    }
    
    setProductRows(updatedRows)
    console.log("Saving row:", row)
  }

  const deleteRow = (rowIndex: number) => {
    console.log("[v0] Delete button clicked for row index:", rowIndex)

    console.log("[v0] Deleting row, saving current state to undo stack")
    saveToUndoStack(productRows)

    const rowToDelete = filteredRows[rowIndex]
    console.log("[v0] Row to delete:", rowToDelete)

    // Find the actual index in productRows array
    const actualIndex = productRows.findIndex((row, idx) => {
      // For new rows or rows with temporary IDs, use array index as fallback
      if (row.isNew || row.product.id.startsWith("temp-")) {
        return (
          idx ===
          productRows.findIndex(
            (pRow) =>
              pRow.product.name === rowToDelete.product.name &&
              pRow.customer.name === rowToDelete.customer.name &&
              pRow.warehouse.name === rowToDelete.warehouse.name,
          )
        )
      }
      // For existing rows, use ID matching
      return (
        row.product.id === rowToDelete.product.id &&
        row.customer.id === rowToDelete.customer.id &&
        row.warehouse.id === rowToDelete.warehouse.id
      )
    })

    console.log("[v0] Actual index to delete:", actualIndex)

    if (actualIndex !== -1) {
      const updatedRows = productRows.filter((_, idx) => idx !== actualIndex)
      setProductRows(updatedRows)
      console.log("[v0] Row deleted successfully")
    } else {
      console.log("[v0] Row not found for deletion")
    }
  }

  const handleAddSale = (productId: string, customerId: string, warehouseId: string, month: number) => {
    console.log(
      `Adding sale for Product: ${productId}, Customer: ${customerId}, Warehouse: ${warehouseId}, Month: ${month}`,
    )
  }

  const checkForDuplicates = useCallback(
    (productName: string, customerName: string, currentRowIndex: number) => {
      if (!productName?.trim() || !customerName?.trim()) return

      const duplicateExists = productRows.some((row, index) => {
        if (index === currentRowIndex) return false
        return (
          row?.product?.name?.toLowerCase().trim() === productName.toLowerCase().trim() &&
          row?.customer?.name?.toLowerCase().trim() === customerName.toLowerCase().trim()
        )
      })

      if (duplicateExists) {
        setDuplicateAlert(`Duplicate entry detected: ${productName} with customer ${customerName} already exists!`)
        setTimeout(() => setDuplicateAlert(""), 5000)
      }
    },
    [productRows],
  )

  const getSuggestions = (field: string, value: string) => {
    if (!Array.isArray(productRows)) {
      return []
    }

    let allValues: string[] = []
    if (field === "product.name") {
      allValues = [...new Set(productRows.map((row) => row?.product?.name).filter((name) => name?.trim()))]
    } else if (field === "customer.name") {
      allValues = [
        ...new Set([
          ...productRows.map((row) => row?.customer?.name).filter((name) => name?.trim()),
          ...customers.map((c) => c.name),
        ]),
      ]
    } else if (field === "warehouse.name") {
      allValues = [
        ...new Set([
          ...productRows.map((row) => row?.warehouse?.name).filter((name) => name?.trim()),
          ...warehouses.map((w) => w.name),
        ]),
      ]
    }

    const query = value
    return allValues.filter((value) => value?.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
  }

  const showSuggestions = (field: string, value: string, rowIndex: number, element: HTMLElement) => {
    const suggestionItems = getSuggestions(field, value)

    if (suggestionItems.length > 0) {
      const rect = element.getBoundingClientRect()
      setSuggestions({
        items: suggestionItems,
        field,
        rowIndex,
        show: true,
        position: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        },
      })
    } else {
      setSuggestions((prev) => ({ ...prev, show: false }))
    }
  }

  const hideSuggestions = () => {
    setTimeout(() => setSuggestions((prev) => ({ ...prev, show: false })), 150)
  }

  const selectSuggestion = (suggestion: string) => {
    updateCellValue(suggestions.rowIndex, suggestions.field, suggestion)
    setSuggestions((prev) => ({ ...prev, show: false }))

    // Check for duplicates after selecting suggestion
    if (suggestions.field === "product.name" || suggestions.field === "customer.name") {
      const row = productRows[suggestions.rowIndex]
      const productName = suggestions.field === "product.name" ? suggestion : row.product.name
      const customerName = suggestions.field === "customer.name" ? suggestion : row.customer.name
      checkForDuplicates(productName, customerName, suggestions.rowIndex)
    }
  }

  const startShipmentEdit = (rowIndex: number, monthKey: string) => {
    setEditingShipment({
      rowIndex,
      monthKey,
      shipmentNumber: "",
      quantity: "",
    })
  }

  const cancelShipmentEdit = () => {
    setEditingShipment(null)
  }

  const saveShipment = () => {
    if (!editingShipment) return

    console.log("[v0] Saving shipment, saving current state to undo stack")
    console.log("[v0] Shipment data:", editingShipment)
    saveToUndoStack(productRows)

    const updatedRows = [...productRows]
    const actualRowIndex = productRows.findIndex(
      (row) =>
        row.product.id === filteredRows[editingShipment.rowIndex].product.id &&
        row.customer.id === filteredRows[editingShipment.rowIndex].customer.id &&
        row.warehouse.id === filteredRows[editingShipment.rowIndex].warehouse.id,
    )

    if (actualRowIndex === -1) return

    const row = updatedRows[actualRowIndex]
    const monthKey = editingShipment.monthKey
    const shipments = [...(row.monthly_shipments[monthKey] || [])]

    const shipmentData = {
      shipment_number: editingShipment.shipmentNumber,
      quantity: Number.parseFloat(editingShipment.quantity) || 0,
      formatting: { color: "black", bold: false },
    }

    if (editingShipment.shipmentIndex !== undefined) {
      shipments[editingShipment.shipmentIndex] = shipmentData
    } else {
      shipments.push(shipmentData)
    }

    row.monthly_shipments[monthKey] = shipments
    console.log("[v0] Shipment saved to row:", { monthKey, shipments: row.monthly_shipments[monthKey] })
    setProductRows(updatedRows)
    setEditingShipment(null)

    // Dispatch custom event to notify shipment management component
    console.log('[ProductManagement] Dispatching shipmentAdded event')
    window.dispatchEvent(new CustomEvent('shipmentAdded', { 
      detail: { 
        shipmentNumber: editingShipment.shipmentNumber,
        monthKey: monthKey,
        productName: row.product.name,
        customerName: row.customer.name,
        warehouseName: row.warehouse.name
      }
    }))
    
    // Also dispatch the localStorageChange event to ensure compatibility
    console.log('[ProductManagement] Dispatching localStorageChange event')
    window.dispatchEvent(new Event('localStorageChange'))

    // Recalculate stock values when shipments change - call directly to avoid timing issues
    calculateStockValues(updatedRows)
  }

  const editShipment = (rowIndex: number, monthKey: string, shipmentIndex: number) => {
    const row = filteredRows[rowIndex]
    const shipment = row.monthly_shipments[monthKey]?.[shipmentIndex]
    if (shipment) {
      setEditingShipment({
        rowIndex,
        monthKey,
        shipmentIndex,
        shipmentNumber: shipment.shipment_number,
        quantity: shipment.quantity.toString(),
      })
    }
  }

  const deleteShipment = (rowIndex: number, monthKey: string, shipmentIndex: number) => {
    console.log("[v0] Deleting shipment, saving current state to undo stack")
    saveToUndoStack(productRows)
    const updatedRows = [...productRows]
    const actualRowIndex = productRows.findIndex(
      (row) =>
        row.product.id === filteredRows[rowIndex].product.id &&
        row.customer.id === filteredRows[rowIndex].customer.id &&
        row.warehouse.id === filteredRows[rowIndex].warehouse.id,
    )

    if (actualRowIndex !== -1) {
      updatedRows[actualRowIndex].monthly_shipments[monthKey] =
        updatedRows[actualRowIndex].monthly_shipments[monthKey]?.filter((_, index) => index !== shipmentIndex) || []
      setProductRows(updatedRows)
      
      // Recalculate stock values when shipments are deleted - call directly to avoid timing issues
      calculateStockValues(updatedRows)
    }
  }

  const handleRightClick = (e: React.MouseEvent, rowIndex: number, field: string, monthKey?: string) => {
    e.preventDefault()
    
    // Get viewport dimensions and scroll position
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const scrollX = window.scrollX || window.pageXOffset
    const scrollY = window.scrollY || window.pageYOffset
    
    // Get table container scroll position if available
    const tableContainer = e.currentTarget.closest('.overflow-x-auto')
    const tableScrollLeft = tableContainer?.scrollLeft || 0
    
    // Get actual context menu dimensions if available, otherwise use estimates
    const menuWidth = contextMenuRef.current?.offsetWidth || 200
    const menuHeight = contextMenuRef.current?.offsetHeight || 200
    
    // Safety margins to ensure menu is fully visible
    const safetyMargin = 10
    
    // Calculate smart positioning to ensure menu is always visible
    let x = e.clientX + scrollX
    let y = e.clientY + scrollY
    
    // Adjust horizontal position if menu would go off-screen to the right
    if (x + menuWidth + safetyMargin > viewportWidth + scrollX) {
      x = e.clientX + scrollX - menuWidth
    }
    
    // Adjust vertical position if menu would go off-screen to the bottom
    if (y + menuHeight + safetyMargin > viewportHeight + scrollY) {
      y = e.clientY + scrollY - menuHeight
    }
    
    // Ensure menu doesn't go off-screen to the left or top with safety margins
    x = Math.max(scrollX + safetyMargin, x)
    y = Math.max(scrollY + safetyMargin, y)
    
    // Add small offset for better visual appearance
    x += 5
    y += 5
    
    setContextMenu({
      x,
      y,
      rowIndex,
      field,
      monthKey,
    })
  }

  const applyFormatting = (color: string, bold?: boolean) => {
    if (!contextMenu) return

    const cellKey = contextMenu.monthKey
      ? `${contextMenu.rowIndex}-${contextMenu.monthKey}`
      : `${contextMenu.rowIndex}-${contextMenu.field}`

    // Check if this is a shipment field
    if (contextMenu.field === "shipment" && contextMenu.monthKey) {
      const monthKey = contextMenu.monthKey
      const parts = monthKey.split("-")

      if (parts.length >= 3) {
        const baseKey = parts.slice(0, -1).join("-") // Remove the last part (number/quantity)
        const shipmentNumberKey = `${contextMenu.rowIndex}-${baseKey}-number`
        const shipmentQuantityKey = `${contextMenu.rowIndex}-${baseKey}-quantity`

        // Apply formatting to both shipment number and quantity
        setCellFormatting((prev) => ({
          ...prev,
          [shipmentNumberKey]: {
            color,
            bold: bold !== undefined ? bold : prev[shipmentNumberKey]?.bold || false,
          },
          [shipmentQuantityKey]: {
            color,
            bold: bold !== undefined ? bold : prev[shipmentQuantityKey]?.bold || false,
          },
        }))
      }
    } else if (contextMenu.field === "shipment-edit" && contextMenu.monthKey) {
      // Handle shipment editing fields
      const monthKey = contextMenu.monthKey
      const baseKey = monthKey.split("-")[0] // Get the month part
      const shipmentNumberKey = `${contextMenu.rowIndex}-${baseKey}-number`
      const shipmentQuantityKey = `${contextMenu.rowIndex}-${baseKey}-quantity`

      // Apply formatting to both shipment edit fields
      setCellFormatting((prev) => ({
        ...prev,
        [shipmentNumberKey]: {
          color,
          bold: bold !== undefined ? bold : prev[shipmentNumberKey]?.bold || false,
        },
        [shipmentQuantityKey]: {
          color,
          bold,
        },
      }))
    } else {
      // Regular field formatting
      setCellFormatting((prev) => ({
        ...prev,
        [cellKey]: {
          color,
          bold,
        },
      }))
    }
    setContextMenu(null)
  }

  const toggleBold = () => {
    if (!contextMenu) return

    const cellKey = contextMenu.monthKey
      ? `${contextMenu.rowIndex}-${contextMenu.monthKey}`
      : `${contextMenu.rowIndex}-${contextMenu.field}`

    // Check if this is a shipment field
    if (contextMenu.field === "shipment" && contextMenu.monthKey) {
      const monthKey = contextMenu.monthKey
      const parts = monthKey.split("-")

      if (parts.length >= 3) {
        const baseKey = parts.slice(0, -1).join("-") // Remove the last part (number/quantity)
        const shipmentNumberKey = `${contextMenu.rowIndex}-${baseKey}-number`
        const shipmentQuantityKey = `${contextMenu.rowIndex}-${baseKey}-quantity`

        // Get current bold state from either field
        const currentBold =
          cellFormatting[shipmentNumberKey]?.bold || cellFormatting[shipmentQuantityKey]?.bold || false

        // Toggle bold for both shipment number and quantity
        setCellFormatting((prev) => ({
          ...prev,
          [shipmentNumberKey]: {
            color: prev[shipmentNumberKey]?.color || "black",
            bold: !currentBold,
          },
          [shipmentQuantityKey]: {
            color: prev[shipmentQuantityKey]?.color || "black",
            bold: !currentBold,
          },
        }))
      }
    } else if (contextMenu.field === "shipment-edit" && contextMenu.monthKey) {
      // Handle shipment editing fields
      const monthKey = contextMenu.monthKey
      const baseKey = monthKey.split("-")[0] // Get the month part
      const shipmentNumberKey = `${contextMenu.rowIndex}-${baseKey}-number`
      const shipmentQuantityKey = `${contextMenu.rowIndex}-${baseKey}-quantity`

      // Get current bold state from either field
      const currentBold = cellFormatting[shipmentNumberKey]?.bold || cellFormatting[shipmentQuantityKey]?.bold || false

      // Toggle bold for both shipment edit fields
      setCellFormatting((prev) => ({
        ...prev,
        [shipmentNumberKey]: {
          color: prev[shipmentNumberKey]?.color || "black",
          bold: !currentBold,
        },
        [shipmentQuantityKey]: {
          color: prev[shipmentQuantityKey]?.color || "black",
          bold: !currentBold,
        },
      }))
    } else {
      // Regular field bold toggle
      setCellFormatting((prev) => ({
        ...prev,
        [cellKey]: {
          color: prev[cellKey]?.color || "black",
          bold: !prev[cellKey]?.bold,
        },
      }))
    }
    setContextMenu(null)
  }

  const getCellStyle = (rowIndex: number, field: string, monthKey?: string) => {
    const cellKey = monthKey ? `${rowIndex}-${monthKey}` : `${rowIndex}-${field}`
    const formatting = cellFormatting[cellKey]
    if (!formatting) return {}

    return {
      color: formatting.color,
      fontWeight: formatting.bold ? "bold" : "normal",
    }
  }

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  // Add keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        console.log("[v0] Ctrl+Z pressed, triggering undo")
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        console.log("[v0] Ctrl+Shift+Z pressed, triggering redo")
        handleRedo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        console.log("[v0] Ctrl+Y pressed, triggering redo")
        handleRedo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undoStack.length, redoStack.length, productRows])

  // Ensure context menu is always visible after rendering
  useEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const menu = contextMenuRef.current
      const rect = menu.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Check if menu is off-screen and adjust if needed
      if (rect.right > viewportWidth) {
        const newX = contextMenu.x - (rect.right - viewportWidth) - 10
        setContextMenu(prev => prev ? { ...prev, x: newX } : null)
      }
      
      if (rect.bottom > viewportHeight) {
        const newY = contextMenu.y - (rect.bottom - viewportHeight) - 10
        setContextMenu(prev => prev ? { ...prev, y: newY } : null)
      }
      
      if (rect.left < 0) {
        const newX = contextMenu.x - rect.left + 10
        setContextMenu(prev => prev ? { ...prev, x: newX } : null)
      }
      
      if (rect.top < 0) {
        const newY = contextMenu.y - rect.top + 10
        setContextMenu(prev => prev ? { ...prev, y: newY } : null)
      }
    }
  }, [contextMenu])

  const handleUndo = () => {
    if (undoStack.length === 0) return
    
    console.log("[v0] Undo triggered, current stack length:", undoStack.length)
    
    const previousState = undoStack[undoStack.length - 1]
    console.log("[v0] Previous state:", previousState)
    
    // Save current state to redo stack
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(productRows))])
    
    // Restore previous state
    setProductRows(JSON.parse(JSON.stringify(previousState)))
    
    // Remove the used state from undo stack
    setUndoStack(prev => prev.slice(0, -1))
    
    console.log("[v0] Undo completed, new stack length:", undoStack.length - 1)
    

  }

  const handleRedo = () => {
    if (redoStack.length === 0) return
    
    console.log("[v0] Redo triggered, current redo stack length:", redoStack.length)
    
    const nextState = redoStack[redoStack.length - 1]
    console.log("[v0] Next state:", nextState)
    
    // Save current state to undo stack
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(productRows))])
    
    // Restore next state
    setProductRows(JSON.parse(JSON.stringify(nextState)))
    
    // Remove the used state from redo stack
    setRedoStack(prev => prev.slice(0, -1))
    
    console.log("[v0] Redo completed, new redo stack length:", redoStack.length - 1)
    

  }

  const handleTabNavigation = (currentRowIndex: number, currentField: string, shiftKey: boolean) => {
    const fieldOrder = ["product.name", "customer.name", "warehouse.name", "unit", "annual_volume", ...monthKeys]
    const currentFieldIndex = fieldOrder.indexOf(currentField)

    if (currentFieldIndex === -1) return

    let nextFieldIndex: number
    let nextRowIndex = currentRowIndex

    if (shiftKey) {
      // Shift+Tab: Move backward
      nextFieldIndex = currentFieldIndex - 1
      if (nextFieldIndex < 0) {
        // Move to previous row, last field
        nextRowIndex = currentRowIndex - 1
        nextFieldIndex = fieldOrder.length - 1
      }
    } else {
      // Tab: Move forward
      nextFieldIndex = currentFieldIndex + 1
      if (nextFieldIndex >= fieldOrder.length) {
        // Move to next row, first field
        nextRowIndex = currentRowIndex + 1
        nextFieldIndex = 0
      }
    }

    // Check if the target row exists
    if (nextRowIndex < 0 || nextRowIndex >= filteredRows.length) return

    const nextField = fieldOrder[nextFieldIndex]

    // Stop current cell editing
    stopCellEditing(currentRowIndex, currentField)

    // Start editing the next cell
    setTimeout(() => {
      startCellEditing(nextRowIndex, nextField)
    }, 50)
  }

  const startCellEditing = (rowIndex: number, field: string) => {
    const newEditingCells = new Set(editingCells)
    newEditingCells.add(`${rowIndex}-${field}`)
    setEditingCells(newEditingCells)

    // Set focus to the input element after a short delay to ensure it's rendered
    setTimeout(() => {
      const inputElement = document.querySelector(
        `input[data-row="${rowIndex}"][data-field="${field}"], select[data-row="${rowIndex}"][data-field="${field}"]`,
      ) as HTMLInputElement | HTMLSelectElement
      if (inputElement) {
        inputElement.focus()
        if (inputElement instanceof HTMLInputElement) {
          inputElement.select() // Select all text for easier editing (only for input elements)
        }
      }
    }, 100)
  }

  const monthKeys = months.map((month) => `monthly_sales.${month.key}`)

  const getCellFormatting = (cellKey: string) => {
    return cellFormatting[cellKey]
  }

  const handleExportExcel = useCallback(() => {
    try {
      // Create CSV data as fallback that works in all environments
      const exportData = filteredRows.map((row, index) => {
        const rowData: any = {
          "S.No": index + 1,
          "Product Name": row.product.name || "",
          "Customer Name": row.customer.name || "",
          Warehouse: row.warehouse.name || "",
          Unit: row.product.unit || "",
          "Annual Volume": row.annual_volume || 0,
        }

        // Add monthly sales data
        const months = [
          "jan24",
          "feb24",
          "mar24",
          "apr24",
          "may24",
          "jun24",
          "jul24",
          "aug24",
          "sep24",
          "oct24",
          "nov24",
          "dec24",
        ]

        months.forEach((month) => {
          const monthName = month.charAt(0).toUpperCase() + month.slice(1, 3) + " " + month.slice(3)
          rowData[monthName] = row.monthly_sales?.[month] || 0
        })

        // Add total sales
        rowData["Total Sales"] = row.total_sales || 0

        return rowData
      })

      // Add stock summary data
      const groups = groupRowsByProductWarehouse(filteredRows)
      Object.entries(groups).forEach(([groupKey, groupRows]) => {
        const [productName, warehouseName] = groupKey.split("-")

        // Add opening stock row
        const openingStockRow: any = {
          "S.No": "",
          "Product Name": productName,
          "Customer Name": "OPENING STOCK",
          Warehouse: warehouseName,
          Unit: groupRows[0]?.product.unit || "",
          "Annual Volume": "",
        }

        const months = [
          "jan24",
          "feb24",
          "mar24",
          "apr24",
          "may24",
          "jun24",
          "jul24",
          "aug24",
          "sep24",
          "oct24",
          "nov24",
          "dec24",
        ]

        months.forEach((month) => {
          const monthName = month.charAt(0).toUpperCase() + month.slice(1, 3) + " " + month.slice(3)
          openingStockRow[monthName] = groupRows[0]?.monthly_opening_stock?.[month] || 0
        })

        exportData.push(openingStockRow)

        // Add shipments data
        const shipmentsRow: any = {
          "S.No": "",
          "Product Name": productName,
          "Customer Name": "SHIPMENTS",
          Warehouse: warehouseName,
          Unit: groupRows[0]?.product.unit || "",
          "Annual Volume": "",
        }

        months.forEach((month) => {
          const monthName = month.charAt(0).toUpperCase() + month.slice(1, 3) + " " + month.slice(3)
          const shipments = groupRows[0]?.monthly_shipments?.[month] || []
          const totalShipments = shipments.reduce((sum: number, shipment: any) => sum + (shipment.quantity || 0), 0)
          shipmentsRow[monthName] = totalShipments
        })

        exportData.push(shipmentsRow)

        // Add closing stock row
        const closingStockRow: any = {
          "S.No": "",
          "Product Name": productName,
          "Customer Name": "CLOSING STOCK",
          Warehouse: warehouseName,
          Unit: groupRows[0]?.product.unit || "",
          "Annual Volume": "",
        }

        months.forEach((month) => {
          const monthName = month.charAt(0).toUpperCase() + month.slice(1, 3) + " " + month.slice(3)
          closingStockRow[monthName] = groupRows[0]?.monthly_closing_stock?.[month] || 0
        })

        exportData.push(closingStockRow)
      })

      if (exportData.length === 0) {
        alert("No data to export")
        return
      }

      // Get headers from first row
      const headers = Object.keys(exportData[0])

      // Create CSV content
      const csvContent = [
        headers.join(","), // Header row
        ...exportData.map((row) =>
          headers
            .map((header) => {
              const value = row[header]
              // Escape commas and quotes in values
              if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`
              }
              return value
            })
            .join(","),
        ),
      ].join("\n")

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")

      // Generate filename with current date
      const now = new Date()
      const filename = `inventory_data_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}.csv`

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", filename)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error)
      alert("Error exporting data. Please try again.")
    }
  }, [filteredRows, groupRowsByProductWarehouse])

  const handleSearchClick = () => {
    const query = prompt("Search by product / customer / warehouse:", searchQuery)
    if (query !== null) {
      setSearchQuery(query)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          <div className="text-lg font-semibold text-slate-700">Loading product data...</div>
          <div className="text-sm text-slate-500">Please wait while we fetch your inventory information</div>
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
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Product Admin</h1>
              <p className="text-slate-600 text-sm font-medium">Manage your inventory and product data</p>
            </div>

            <div className="flex items-center gap-6">
              {/* Search and Actions Group */}
              <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSearchClick}
                  className="hover:bg-slate-100 hover:text-slate-700 transition-all duration-200 rounded-lg"
                >
                  <Search className="h-4 w-4 text-slate-600" />
                </Button>

                <div className="w-px h-6 bg-slate-200" />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="hover:bg-slate-100 hover:text-slate-700 transition-all duration-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  title={`Undo (${undoStack.length} available) - Ctrl+Z`}
                >
                  <RotateCcw className="h-4 w-4 text-slate-600" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="hover:bg-slate-100 hover:text-slate-700 transition-all duration-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  title={`Redo (${redoStack.length} available) - Ctrl+Y`}
                >
                  <RotateCw className="h-4 w-4 text-slate-600" />
                </Button>
              </div>



              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-all duration-200 shadow-sm rounded-lg font-medium"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>

              {/* Primary Action */}
              <Button
                size="sm"
                onClick={handleAddProduct}
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-2 rounded-xl font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>


            </div>

            {/* Search Query Display */}
            {searchQuery && (
              <div className="absolute top-24 right-8 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl text-sm shadow-lg backdrop-blur-sm">
                <Search className="h-4 w-4 text-indigo-600" />
                <span className="text-indigo-800 font-medium">"{searchQuery}"</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="h-6 w-6 p-0 hover:bg-indigo-100 hover:text-indigo-700 ml-1 rounded-lg transition-all duration-200"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {!canUseSupabase() && (
            <div className="border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-6 rounded-xl shadow-sm mb-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <div className="text-amber-800">
                  <strong className="font-semibold">Demo Mode:</strong> Supabase is not configured. Using mock data for demonstration. Please
                  configure your environment variables in Project Settings to use live data.
                </div>
              </div>
            </div>
          )}

          {duplicateAlert && (
            <div className="border border-red-200 bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-xl shadow-sm mb-6">
              <div className="flex items-center gap-3 text-red-800 font-medium">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                ⚠️ {duplicateAlert}
              </div>
            </div>
          )}



          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-slate-100 rounded-lg border border-slate-200">
                <span className="text-sm font-semibold text-slate-700">Total Rows: <span className="text-indigo-600">{filteredRows.length}</span></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
              <span className="text-sm font-semibold text-slate-700">Table Zoom:</span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTableZoomLevel(Math.max(20, tableZoomLevel - 10))}
              className="h-8 w-8 p-0 hover:bg-white hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-200"
            >
              <Minus className="h-4 w-4 text-slate-600" />
            </Button>

            <div
              className="w-24 h-2 bg-slate-200 rounded-full relative cursor-pointer shadow-inner"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const percentage = Math.max(20, Math.min(100, (clickX / rect.width) * 100))
                setTableZoomLevel(Math.round(percentage))
              }}
            >
              <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-200" style={{ width: `${tableZoomLevel}%` }} />
              <div
                className="absolute top-0 w-4 h-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transform -translate-y-1 cursor-grab active:cursor-grabbing shadow-lg border-2 border-white"
                style={{ left: `calc(${tableZoomLevel}% - 8px)` }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  const slider = e.currentTarget.parentElement
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const rect = slider!.getBoundingClientRect()
                    const moveX = moveEvent.clientX - rect.left
                    const percentage = Math.max(20, Math.min(100, (moveX / rect.width) * 100))
                    setTableZoomLevel(Math.round(percentage))
                  }
                  const handleMouseUp = () => {
                    document.removeEventListener("mousemove", handleMouseMove)
                    document.removeEventListener("mouseup", handleMouseUp)
                  }
                  document.addEventListener("mousemove", handleMouseMove)
                  document.addEventListener("mouseup", handleMouseUp)
                }}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTableZoomLevel(Math.min(100, tableZoomLevel + 10))}
              className="h-8 w-8 p-0 hover:bg-white hover:shadow-lg transition-all duration-200 rounded-lg border border-slate-200"
            >
              <Plus className="h-4 w-4 text-slate-600" />
            </Button>

            <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-sm">
              <span className="text-sm font-bold text-slate-700 min-w-[32px]">{tableZoomLevel}%</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTableZoomLevel(60)}
              className="text-xs px-3 h-8 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200 rounded-lg font-medium"
            >
              Reset
            </Button>
          </div>

          <div className="border-2 border-slate-200 bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse"
                style={{
                  transform: `scale(${tableZoomLevel / 100})`,
                  transformOrigin: "top left",
                  width: `${100 / (tableZoomLevel / 100)}%`,
                }}
              >
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                      <div className="flex items-center justify-center">
                        <span className="text-black font-medium">Product Name</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                          onClick={() => handleAddToColumn("product.name")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                      <div className="flex items-center justify-center">
                        <span className="text-black font-medium">Customer Name</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                          onClick={() => handleAddToColumn("customer.name")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[100px] bg-gray-100">
                      <div className="flex items-center justify-center">
                        <span className="text-black font-medium">Warehouse</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                          onClick={() => handleAddToColumn("warehouse.name")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[80px] text-black font-medium bg-gray-100">
                      Unit
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[120px] bg-gray-100">
                      <div className="flex items-center justify-center">
                        <span className="text-black font-medium">Annual Volume</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                          onClick={() => handleAddToColumn("annual_volume")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </th>
                    {months.map(({ key, label }) => (
                      <th key={key} className="border border-gray-300 text-center p-2 min-w-[150px] bg-gray-100">
                        <div className="flex items-center justify-center">
                          <span className="text-black font-medium">{label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 hover:bg-gray-200 ml-2"
                            onClick={() => handleAddToColumn("monthly_sales", key)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </th>
                    ))}
                    <th className="border border-gray-300 text-center p-2 min-w-[100px] text-black font-medium bg-gray-100">
                      Total Sales
                    </th>
                    <th className="border border-gray-300 text-center p-2 min-w-[100px] text-black font-medium bg-gray-100">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={months.length + 6}
                        className="border border-gray-300 text-center p-8 text-black bg-white"
                      >
                        No products found. Click "Add Product" to create your first product entry.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const groups = groupRowsByProductWarehouse(filteredRows)
                      const result: ReactElement[] = []

                      Object.entries(groups).forEach(([groupKey, groupRows]) => {
                        const [productName, warehouseName] = groupKey.split("-")
                        const { consolidatedOpeningStock, consolidatedClosingStock } =
                          calculateConsolidatedStock(groupRows)

                        // Add regular rows for this group
                        groupRows.forEach((row, groupIndex) => {
                          const originalIndex = filteredRows.findIndex(
                            (r) =>
                              r.product.id === row.product.id &&
                              r.customer.id === row.customer.id &&
                              r.warehouse.id === row.warehouse.id,
                          )

                          result.push(
                            <tr
                              key={`${row.product.id}-${row.customer.id}-${row.warehouse.id}`}
                              className="bg-white hover:bg-gray-50"
                            >
                              {/* ... existing table row content ... */}
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "product.name") ? (
                                  <Input
                                    data-row={originalIndex}
                                    data-field="product.name"
                                    value={row.product.name}
                                    onChange={(e) => updateCellValue(originalIndex, "product.name", e.target.value)}
                                    onBlur={() => {
                                      stopCellEditing(originalIndex, "product.name")
                                      hideSuggestions()
                                    }}
                                    onFocus={(e) => {
                                      setCurrentlyFocusedCell({ rowIndex: originalIndex, field: "product.name" })
                                      if (e.target.value) {
                                        showSuggestions(
                                          "product.name",
                                          e.target.value,
                                          originalIndex,
                                          e.target as HTMLElement,
                                        )
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        stopCellEditing(originalIndex, "product.name")
                                        hideSuggestions()
                                      } else if (e.key === "Escape") {
                                        hideSuggestions()
                                      } else if (e.key === "Tab") {
                                        e.preventDefault()
                                        handleTabNavigation(originalIndex, "product.name", e.shiftKey)
                                        hideSuggestions()
                                      }
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "product.name")}
                                    style={getCellStyle(originalIndex, "product.name")}
                                    className="h-8 border-0 bg-transparent focus:ring-0 shadow-none outline-none p-1 text-center w-full uppercase font-bold"
                                    autoFocus={isCellEditing(originalIndex, "product.name")}
                                  />
                                ) : (
                                  <div
                                    className={`cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center uppercase font-bold ${
                                      currentlyFocusedCell?.rowIndex === originalIndex &&
                                      currentlyFocusedCell?.field === "product.name"
                                        ? "font-bold"
                                        : ""
                                    }`}
                                    style={getCellStyle(originalIndex, "product.name")}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-product.name`)
                                      setEditingCells(newEditingCells)
                                      setCurrentlyFocusedCell({ rowIndex: originalIndex, field: "product.name" })
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "product.name")}
                                  >
                                    {row.product.name || ""}
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "customer.name") ? (
                                  <Input
                                    data-row={originalIndex}
                                    data-field="customer.name"
                                    value={row.customer.name}
                                    onChange={(e) => updateCellValue(originalIndex, "customer.name", e.target.value)}
                                    onBlur={() => {
                                      stopCellEditing(originalIndex, "customer.name")
                                      hideSuggestions()
                                    }}
                                    onFocus={(e) => {
                                      if (e.target.value) {
                                        showSuggestions(
                                          "customer.name",
                                          e.target.value,
                                          originalIndex,
                                          e.target as HTMLElement,
                                        )
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        stopCellEditing(originalIndex, "customer.name")
                                        hideSuggestions()
                                      } else if (e.key === "Escape") {
                                        hideSuggestions()
                                      } else if (e.key === "Tab") {
                                        e.preventDefault()
                                        handleTabNavigation(originalIndex, "customer.name", e.shiftKey)
                                        hideSuggestions()
                                      }
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "customer.name")}
                                    style={getCellStyle(originalIndex, "customer.name")}
                                    className="h-8 border-0 bg-transparent focus:ring-0 shadow-none outline-none p-1 text-center w-full"
                                    autoFocus={isCellEditing(originalIndex, "customer.name")}
                                  />
                                ) : (
                                  <div
                                    className="cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center"
                                    style={getCellStyle(originalIndex, "customer.name")}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-customer.name`)
                                      setEditingCells(newEditingCells)
                                      setCurrentlyFocusedCell({ rowIndex: originalIndex, field: "customer.name" })
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "customer.name")}
                                  >
                                    {row.customer.name || ""}
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "warehouse.name") ? (
                                  <Input
                                    data-row={originalIndex}
                                    data-field="warehouse.name"
                                    value={row.warehouse.name}
                                    onChange={(e) => updateCellValue(originalIndex, "warehouse.name", e.target.value)}
                                    onBlur={() => {
                                      stopCellEditing(originalIndex, "warehouse.name")
                                      hideSuggestions()
                                    }}
                                    onFocus={(e) => {
                                      if (e.target.value) {
                                        showSuggestions(
                                          "warehouse.name",
                                          e.target.value,
                                          originalIndex,
                                          e.target as HTMLElement,
                                        )
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        stopCellEditing(originalIndex, "warehouse.name")
                                        hideSuggestions()
                                      } else if (e.key === "Escape") {
                                        hideSuggestions()
                                      } else if (e.key === "Tab") {
                                        e.preventDefault()
                                        handleTabNavigation(originalIndex, "warehouse.name", e.shiftKey)
                                        hideSuggestions()
                                      }
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "warehouse.name")}
                                    style={getCellStyle(originalIndex, "warehouse.name")}
                                    className="h-8 border-0 bg-transparent focus:ring-0 shadow-none outline-none p-1 text-center w-full uppercase font-bold"
                                    autoFocus={isCellEditing(originalIndex, "warehouse.name")}
                                  />
                                ) : (
                                  <div
                                    className="cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center uppercase font-bold"
                                    style={getCellStyle(originalIndex, "warehouse.name")}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-warehouse.name`)
                                      setEditingCells(newEditingCells)
                                      setCurrentlyFocusedCell({ rowIndex: originalIndex, field: "warehouse.name" })
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "warehouse.name")}
                                  >
                                    {row.warehouse.name || ""}
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "unit") ? (
                                  <Select
                                    value={row.unit}
                                    onValueChange={(value) => updateCellValue(originalIndex, "unit", value)}
                                  >
                                    <SelectTrigger className="h-8 border-0 bg-transparent focus:ring-0 shadow-none">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Kgs">Kgs</SelectItem>
                                      <SelectItem value="Lbs">Lbs</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div
                                    className="text-center cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center"
                                    onClick={() => {
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-unit`)
                                      setEditingCells(newEditingCells)
                                    }}
                                  >
                                    {row.unit}
                                  </div>
                                )}
                              </td>
                              <td className="border border-gray-300 p-2 bg-white">
                                {row.isEditing || isCellEditing(originalIndex, "annual_volume") ? (
                                  <Input
                                    data-row={originalIndex}
                                    data-field="annual_volume"
                                    type="number"
                                    value={row.annual_volume}
                                    onChange={(e) => updateCellValue(originalIndex, "annual_volume", e.target.value)}
                                    onBlur={() => stopCellEditing(originalIndex, "annual_volume")}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        stopCellEditing(originalIndex, "annual_volume")
                                      } else if (e.key === "Tab") {
                                        e.preventDefault()
                                        handleTabNavigation(originalIndex, "annual_volume", e.shiftKey)
                                      }
                                    }}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "annual_volume")}
                                    style={getCellStyle(originalIndex, "annual_volume")}
                                    className="h-8 border-0 bg-transparent focus:ring-0 shadow-none outline-none p-1 text-center w-full"
                                    autoFocus={isCellEditing(originalIndex, "annual_volume")}
                                  />
                                ) : (
                                  <div
                                    className="text-center cursor-pointer px-1 py-1 min-h-[32px] flex items-center justify-center"
                                    style={getCellStyle(originalIndex, "annual_volume")}
                                    onContextMenu={(e) => handleRightClick(e, originalIndex, "annual_volume")}
                                    onClick={() => {
                                      const newEditingCells = new Set(editingCells)
                                      newEditingCells.add(`${originalIndex}-annual_volume`)
                                      setEditingCells(newEditingCells)
                                    }}
                                  >
                                    {row.annual_volume.toLocaleString()}
                                  </div>
                                )}
                              </td>
                              {months.map(({ key }) => (
                                <td key={key} className="border border-gray-300 p-1 min-w-[150px] text-center">
                                  <div className="space-y-1">
                                    {/* Sales input */}
                                    <Input
                                      type="number"
                                      value={row.monthly_sales[key] || ""}
                                      onChange={(e) =>
                                        updateCellValue(originalIndex, `monthly_sales.${key}`, e.target.value)
                                      }
                                      className="w-full h-8 text-center border border-gray-300"
                                      style={getCellStyle(originalIndex, "monthly_sales", key)}
                                      onFocus={() =>
                                        setCurrentlyFocusedCell({
                                          rowIndex: originalIndex,
                                          field: `monthly_sales.${key}`,
                                        })
                                      }
                                      onBlur={() => stopCellEditing(originalIndex, `monthly_sales.${key}`)}
                                      onContextMenu={(e) => handleRightClick(e, originalIndex, "monthly_sales", key)}
                                      data-row={originalIndex}
                                      data-field={`monthly_sales.${key}`}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          stopCellEditing(originalIndex, `monthly_sales.${key}`)
                                        } else if (e.key === "Tab") {
                                          e.preventDefault()
                                          handleTabNavigation(originalIndex, `monthly_sales.${key}`, e.shiftKey)
                                        }
                                      }}
                                    />
                                  </div>
                                </td>
                              ))}
                              <td className="border border-gray-300 p-2 text-center bg-white">
                                {row.total_sales.toLocaleString()}
                              </td>
                              <td className="border border-gray-300 p-2 text-center bg-white">
                                <div className="flex gap-1 justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteRow(originalIndex)}
                                    className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                  {(row.isEditing || row.isNew) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => saveRow(originalIndex)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      Save
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>,
                          )
                        })

                        result.push(
                          // Opening Stock Row
                          <tr key={`${groupKey}-opening-stock`} className="bg-blue-50 border-t-2 border-blue-300">
                            <td className="border border-gray-300 p-2 font-semibold text-black">Opening Stock</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.product.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.warehouse.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }) => (
                              <td key={key} className="border border-gray-300 p-1 text-center">
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    value={consolidatedOpeningStock[key] || ""}
                                    onChange={(e) =>
                                      updateGroupOpeningStock(
                                        groupRows[0]?.product.name || "",
                                        groupRows[0]?.warehouse.name || "",
                                        key,
                                        e.target.value,
                                      )
                                    }
                                    className="w-full h-8 text-center border border-gray-300 bg-white"
                                  />
                                </div>
                              </td>
                            ))}
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>,

                          <tr key={`${groupKey}-shipments`} className="bg-orange-50 border-t border-orange-300">
                            <td className="border border-gray-300 p-2 font-semibold text-black">Shipments</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.product.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.warehouse.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }) => (
                              <td key={key} className="border border-gray-300 p-1 text-center">
                                <div className="space-y-1">
                                  {/* Display existing shipments */}
                                  {groupRows[0]?.monthly_shipments?.[key]?.map((shipment, shipmentIndex) => (
                                    <div key={shipmentIndex} className="flex items-center justify-between text-xs mt-1">
                                      <span
                                        className="cursor-pointer"
                                        onContextMenu={(e) =>
                                          handleRightClick(
                                            e,
                                            filteredRows.findIndex((r) => r === groupRows[0]),
                                            "shipment",
                                            `${key}-${shipmentIndex}-number`,
                                          )
                                        }
                                        style={getCellStyle(
                                          filteredRows.findIndex((r) => r === groupRows[0]),
                                          "shipment",
                                          `${key}-${shipmentIndex}-number`,
                                        )}
                                      >
                                        {shipment.shipment_number}
                                      </span>
                                      <span
                                        className="cursor-pointer"
                                        onContextMenu={(e) =>
                                          handleRightClick(
                                            e,
                                            filteredRows.findIndex((r) => r === groupRows[0]),
                                            "shipment",
                                            `${key}-${shipmentIndex}-quantity`,
                                          )
                                        }
                                        style={getCellStyle(
                                          filteredRows.findIndex((r) => r === groupRows[0]),
                                          "shipment",
                                          `${key}-${shipmentIndex}-quantity`,
                                        )}
                                      >
                                        {shipment.quantity}
                                      </span>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-4 w-4 p-0 text-blue-600 hover:text-blue-800"
                                          onClick={() =>
                                            editShipment(
                                              filteredRows.findIndex((r) => r === groupRows[0]),
                                              key,
                                              shipmentIndex,
                                            )
                                          }
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-4 w-4 p-0 text-red-600 hover:text-red-800"
                                          onClick={() =>
                                            deleteShipment(
                                              filteredRows.findIndex((r) => r === groupRows[0]),
                                              key,
                                              shipmentIndex,
                                            )
                                          }
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Shipment editing interface */}
                                  {editingShipment?.rowIndex === filteredRows.findIndex((r) => r === groupRows[0]) &&
                                    editingShipment?.monthKey === key && (
                                      <div className="space-y-1 mt-2 p-2 bg-white border border-orange-300 rounded">
                                        <Input
                                          type="text"
                                          placeholder="Shipment #"
                                          value={editingShipment.shipmentNumber}
                                          onChange={(e) =>
                                            setEditingShipment({
                                              ...editingShipment,
                                              shipmentNumber: e.target.value,
                                            })
                                          }
                                          className="w-full h-6 text-xs bg-white border border-gray-300"
                                          autoFocus
                                        />
                                        <Input
                                          type="number"
                                          placeholder="Quantity"
                                          value={editingShipment.quantity}
                                          onChange={(e) =>
                                            setEditingShipment({
                                              ...editingShipment,
                                              quantity: e.target.value,
                                            })
                                          }
                                          className="w-full h-6 text-xs bg-white border border-gray-300"
                                        />
                                        <div className="flex gap-1 justify-center">
                                          <Button
                                            size="sm"
                                            onClick={saveShipment}
                                            className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                                          >
                                            <Check className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={cancelShipmentEdit}
                                            className="h-6 px-2 text-xs bg-transparent"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                  {/* Add shipment button */}
                                  {(!editingShipment ||
                                    editingShipment.rowIndex !== filteredRows.findIndex((r) => r === groupRows[0]) ||
                                    editingShipment.monthKey !== key) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        startShipmentEdit(
                                          filteredRows.findIndex((r) => r === groupRows[0]),
                                          key,
                                        )
                                      }
                                      className="w-full h-6 text-xs mt-1 border-orange-300 text-orange-700 hover:bg-orange-100"
                                    >
                                      + Shipment
                                    </Button>
                                  )}
                                </div>
                              </td>
                            ))}
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>,
                        )

                        result.push(
                          // Closing Stock Row
                          <tr key={`${groupKey}-closing-stock`} className="bg-green-50 border-b-4 border-red-500">
                            <td className="border border-gray-300 p-2 font-semibold text-black">
                              Closing Stock
                              <div className="text-xs text-gray-600 mt-1">
                                Formula: Opening + Shipments - Sales
                              </div>
                            </td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.product.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.warehouse.name}</td>
                            <td className="border border-gray-300 p-2 text-black">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }) => {
                              const openingStock = consolidatedOpeningStock[key] || 0
                              const sales = groupRows.reduce((sum, row) => sum + (row.monthly_sales[key] || 0), 0)
                              const shipments = groupRows[0]?.monthly_shipments[key] || []
                              const totalShipments = shipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
                              const closingStock = consolidatedClosingStock[key] || 0
                              
                              return (
                                <td key={key} className="border border-gray-300 p-1 text-center">
                                  <div className="w-full h-8 text-center border border-gray-300 bg-gray-100 flex items-center justify-center font-medium">
                                    {closingStock?.toLocaleString() || "0"}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {openingStock} + {totalShipments} - {sales} = {closingStock}
                                  </div>
                                </td>
                              )
                            })}
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>,
                        )
                      })

                      return result
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8 shadow-lg border-0 bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent flex items-center gap-3">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            Totals by Product x Warehouse (customers combined)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-slate-100 to-gray-100">
                  <th className="border border-slate-200 text-center p-3 min-w-[120px] bg-gradient-to-r from-slate-100 to-gray-100">
                    <span className="text-slate-800 font-semibold">Product</span>
                  </th>
                  <th className="border border-slate-200 text-center p-3 min-w-[120px] bg-gradient-to-r from-slate-100 to-gray-100">
                    <span className="text-slate-800 font-semibold">Warehouse</span>
                  </th>
                  <th className="border border-slate-200 text-center p-3 min-w-[120px] bg-gradient-to-r from-slate-100 to-gray-100">
                    <span className="text-slate-800 font-semibold">Unit</span>
                  </th>
                  <th className="border border-slate-200 text-center p-3 min-w-[120px] bg-gradient-to-r from-slate-100 to-gray-100">
                    <span className="text-slate-800 font-semibold">Total Sales</span>
                  </th>
                  <th className="border border-slate-200 text-center p-3 min-w-[120px] bg-gradient-to-r from-slate-100 to-gray-100">
                    <span className="text-slate-800 font-semibold">Entries</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  if (!Array.isArray(filteredRows)) {
                    return null
                  }

                  const productWarehouseTotals: { [key: string]: any } = {}

                  filteredRows.forEach((row) => {
                    if (!row?.product?.name || !row?.warehouse?.name) return

                    const key = `${row.product.name}-${row.warehouse.name}`
                    if (!productWarehouseTotals[key]) {
                      productWarehouseTotals[key] = {
                        productName: row.product.name,
                        warehouseName: row.warehouse.name,
                        unit: row.unit || "Kgs",
                        totalSales: 0,
                        entries: 0,
                      }
                    }

                    // Calculate total sales
                    if (row.monthly_sales) {
                      Object.values(row.monthly_sales).forEach((sales) => {
                        if (typeof sales === "number") {
                          productWarehouseTotals[key].totalSales += sales
                        }
                      })
                    }

                    productWarehouseTotals[key].entries += 1
                  })

                  const totalsArray = Object.values(productWarehouseTotals)
                  if (!Array.isArray(totalsArray)) {
                    return null
                  }

                  return totalsArray.map((totals, index) => (
                    <tr key={index} className="bg-white hover:bg-slate-50 transition-colors duration-200">
                      <td className="border border-slate-200 p-3 bg-white text-slate-800 font-medium">{totals.productName}</td>
                      <td className="border border-slate-200 p-3 bg-white text-slate-800 font-medium">{totals.warehouseName}</td>
                      <td className="border border-slate-200 p-3 bg-white text-slate-800 font-medium">{totals.unit}</td>
                      <td className="border border-slate-200 p-3 bg-white text-slate-800 font-semibold">
                        <span className="text-indigo-600">{totals.totalSales.toLocaleString()}</span> {totals.unit.toLowerCase()}
                      </td>
                      <td className="border border-slate-200 p-3 bg-white text-slate-800 font-medium">
                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-slate-700">{totals.entries}</span>
                      </td>
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-xl backdrop-blur-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full text-left transition-colors duration-200 rounded-lg mx-1 my-1 font-medium"
            onClick={() => applyFormatting("red")}
          >
            🔴 Red
          </button>
          <button
            className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full text-left transition-colors duration-200 rounded-lg mx-1 my-1 font-medium"
            onClick={() => applyFormatting("green")}
          >
            🟢 Green
          </button>
          <button
            className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full text-left transition-colors duration-200 rounded-lg mx-1 my-1 font-medium"
            onClick={() => applyFormatting("black")}
          >
            ⚫ Black
          </button>
          <button
            className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full text-left transition-colors duration-200 rounded-lg mx-1 my-1 font-medium"
            onClick={() => toggleBold()}
          >
            <strong>B</strong> Toggle Bold
          </button>
        </div>
      )}

      {suggestions.show && (
        <div
          className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-xl backdrop-blur-sm"
          style={{ top: suggestions.position.top, left: suggestions.position.left }}
        >
          {suggestions.items.map((item) => (
            <button
              key={item}
              className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full text-left transition-colors duration-200 rounded-lg mx-1 my-1 font-medium"
              onClick={() => selectSuggestion(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
