"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef, type ReactElement } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RotateCcw, Download, Plus, Minus, RotateCw, Search, Edit, X, Check, ArrowUp, Filter } from "lucide-react"
import { canUseSupabase, supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface Product {
  id: string
  name: string
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
  rowType?: "regular" | "opening_stock" | "direct_shipment"
  monthly_direct_shipment_text?: { [key: string]: string }
  monthly_direct_shipment_quantity?: { [key: string]: number }
}

export default function ProductManagement() {
  const { toast } = useToast()
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [undoStack, setUndoStack] = useState<ProductRow[][]>([])
  const [redoStack, setRedoStack] = useState<ProductRow[][]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  // Function to determine if a warehouse is a direct shipment based on name patterns
  const isDirectShipment = (warehouseName: string): boolean => {
    if (!warehouseName) return true // Empty warehouse names are considered direct shipments
    
    const directShipmentPatterns = [
      'direct',
      'shipment',
      'direct shipment',
      'direct ship',
      'ds',
      'directs'
    ]
    
    const lowerName = warehouseName.toLowerCase()
    return directShipmentPatterns.some(pattern => lowerName.includes(pattern))
  }

  const [tableZoomLevel, setTableZoomLevel] = useState(80)
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
  const [openingStockInputs, setOpeningStockInputs] = useState<{ [key: string]: string }>({})
  const [stockUpdateTrigger, setStockUpdateTrigger] = useState(0)
  const isCalculatingRef = useRef(false)
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)

  // Filter system state
  const [filterType, setFilterType] = useState<"product" | "customer" | "warehouse" | null>(null)
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [filterValueDropdownOpen, setFilterValueDropdownOpen] = useState(false)
  const [filterSearchQuery, setFilterSearchQuery] = useState("")
  const [selectedFilterValues, setSelectedFilterValues] = useState<Set<string>>(new Set())

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

  // Stock calculation function - moved here to avoid hoisting issues
  const calculateStockValues = useCallback((rows: ProductRow[] = productRows) => {
    if (isCalculatingRef.current) {
      console.log("[v0] calculateStockValues already in progress, skipping...")
      return rows
    }
    
    isCalculatingRef.current = true
    
    try {
      console.log("[v0] calculateStockValues called with rows:", rows.length)
      console.log("[v0] calculateStockValues - first row sample:", rows[0] ? {
        product: rows[0].product.name,
        customer: rows[0].customer.name,
        warehouse: rows[0].warehouse.name,
        monthly_sales: rows[0].monthly_sales,
        monthly_opening_stock: rows[0].monthly_opening_stock,
        monthly_closing_stock: rows[0].monthly_closing_stock
      } : "No rows")
      
      const updatedRows = rows.map((row) => {
      // Skip rows that don't have the required monthly data
      if (
        !row ||
        !row.monthly_sales ||
        !row.monthly_shipments ||
        !row.monthly_opening_stock ||
        !row.monthly_closing_stock
      ) {
        console.log("[v0] Skipping row with undefined monthly data:", row)
        return row
      }
      
      // Ensure all monthly data structures are properly initialized
      const updatedRow = { ...row }
      if (!updatedRow.monthly_sales) updatedRow.monthly_sales = {}
      if (!updatedRow.monthly_shipments) updatedRow.monthly_shipments = {}
      if (!updatedRow.monthly_opening_stock) updatedRow.monthly_opening_stock = {}
      if (!updatedRow.monthly_closing_stock) updatedRow.monthly_closing_stock = {}
      
      // Initialize all months with default values if they don't exist
      months.forEach(month => {
        if (!updatedRow.monthly_sales[month.key]) updatedRow.monthly_sales[month.key] = 0
        if (!updatedRow.monthly_shipments[month.key]) updatedRow.monthly_shipments[month.key] = []
        if (!updatedRow.monthly_opening_stock[month.key]) updatedRow.monthly_opening_stock[month.key] = 0
        if (!updatedRow.monthly_closing_stock[month.key]) updatedRow.monthly_closing_stock[month.key] = 0
      })

      // For direct shipment rows, use the direct shipment quantity as sales
      if (updatedRow.rowType === "direct_shipment") {
        console.log("[v0] Processing direct shipment row as sales:", updatedRow.product.name)
        
        // Convert direct shipment quantities to sales for stock calculations
        months.forEach((month) => {
          const monthKey = month.key
          const directShipmentQuantity = updatedRow.monthly_direct_shipment_quantity?.[monthKey] || 0
          updatedRow.monthly_sales[monthKey] = directShipmentQuantity
        })
        
        return updatedRow
      }

      // Calculate closing stock for each month using the formula: Closing Stock = Opening Stock + Shipments - Sales
      months.forEach((month, monthIndex) => {
        const monthKey = month.key
        
        // Get opening stock for this month
        // For the first month, check if there's a manual input value that should be preserved
        let openingStock = updatedRow.monthly_opening_stock[monthKey] || 0
        if (monthIndex === 0) {
          const inputKey = `${updatedRow.product.name}-${updatedRow.warehouse.name}-${monthKey}`
          const manualInputValue = openingStockInputs[inputKey]
          if (manualInputValue && manualInputValue !== "" && manualInputValue !== "0") {
            openingStock = parseFloat(manualInputValue) || 0
            updatedRow.monthly_opening_stock[monthKey] = openingStock
            console.log(`[DEBUG FIX] calculateStockValues - Preserving manual opening stock for ${inputKey}: ${openingStock} (was: ${updatedRow.monthly_opening_stock[monthKey]})`)
          } else {
            // Only use existing opening stock value, don't set defaults
            openingStock = updatedRow.monthly_opening_stock[monthKey] || 0
          }
        }
        
        // Get sales for this month - exclude direct shipment sales from stock calculations
        let sales = updatedRow.monthly_sales[monthKey] || 0
        
        // If this is a direct shipment warehouse, don't include its sales in stock calculations
        if (isDirectShipment(updatedRow.warehouse.name)) {
          console.log(`[v0] Skipping direct shipment sales for stock calculation: ${updatedRow.warehouse.name}`)
          sales = 0
        }
        
        // Calculate total shipment quantity for this month - EXCLUDE direct shipment quantities
        const shipments = updatedRow.monthly_shipments[monthKey] || []
        let totalShipmentQuantity = 0
        
        // Only include shipments from non-direct shipment warehouses
        if (!isDirectShipment(updatedRow.warehouse.name)) {
          totalShipmentQuantity = shipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
        }
        
        // Debug: Log individual shipment quantities
        if (shipments.length > 0) {
          console.log(`[v0] Shipment details for ${monthKey}:`, shipments.map(s => ({ number: s.shipment_number, quantity: s.quantity })))
          console.log(`[v0] Direct shipment warehouse detected: ${updatedRow.warehouse.name}, excluding shipments from stock calculation`)
        }
        
        // Calculate closing stock: Opening Stock + Shipments - Sales (excluding direct shipment sales AND direct shipment quantities)
        const closingStock = openingStock + totalShipmentQuantity - sales
        console.log(`[v0] Stock calculation for ${updatedRow.product.name} - ${updatedRow.customer.name} - ${updatedRow.warehouse.name} - ${monthKey}:`)
        console.log(`[v0]   Opening Stock: ${openingStock}`)
        console.log(`[v0]   Total Shipments: ${totalShipmentQuantity}`)
        console.log(`[v0]   Sales (excluding direct shipments): ${sales}`)
        console.log(`[v0]   Closing Stock: ${openingStock} + ${totalShipmentQuantity} - ${sales} = ${closingStock}`)
        
        // Special debug for CALPRO December
        if (updatedRow.product.name === 'CALPRO' && updatedRow.warehouse.name === 'IGL' && monthKey === 'dec24') {
          console.log(`[DEBUG CALPRO DEC] Customer: ${updatedRow.customer.name}`)
          console.log(`[DEBUG CALPRO DEC] Opening: ${openingStock}, Shipments: ${totalShipmentQuantity}, Sales: ${sales}, Closing: ${closingStock}`)
          console.log(`[DEBUG CALPRO DEC] Expected: 105125 + (-36000) - 8400 = 60725`)
          console.log(`[DEBUG CALPRO DEC] Calculation: ${openingStock} + ${totalShipmentQuantity} - ${sales} = ${closingStock}`)
        }
        
        // Special debug for FIN 90
        if (updatedRow.product.name === 'FIN 90') {
          console.log(`[DEBUG FIN 90] ${monthKey} - Customer: ${updatedRow.customer.name}, Warehouse: ${updatedRow.warehouse.name}`)
          console.log(`[DEBUG FIN 90] Opening: ${openingStock}, Shipments: ${totalShipmentQuantity}, Sales: ${sales}, Closing: ${closingStock}`)
          console.log(`[DEBUG FIN 90] Calculation: ${openingStock} + ${totalShipmentQuantity} - ${sales} = ${closingStock}`)
        }
        
        // Always update the closing stock, even if it's 0
        updatedRow.monthly_closing_stock[monthKey] = closingStock
        
        // Carry forward closing stock to next month's opening stock
        if (monthIndex < months.length - 1) {
          const nextMonthKey = months[monthIndex + 1].key
          
          // Always carry forward the closing stock to become the opening stock for the next month
          // This ensures the chain calculation works properly throughout the year
          updatedRow.monthly_opening_stock[nextMonthKey] = closingStock
          
          // Debug logging for carry-forward
          if (updatedRow.product.name === 'FIN 90') {
            console.log(`[DEBUG FIN 90] Carrying forward closing stock ${closingStock} to next month ${nextMonthKey} opening stock`)
          }
        }
      })

      return updatedRow
    })

      // Don't trigger undo save for automatic calculations
      setProductRows(updatedRows)
      
      // Trigger a re-render to update the UI
      setStockUpdateTrigger(prev => prev + 1)
      
      return updatedRows
    } catch (error) {
      console.error("[v0] Error in calculateStockValues:", error)
      return rows
    } finally {
      // Reset the calculating flag
      isCalculatingRef.current = false
    }
  }, [openingStockInputs])

  // Function to calculate total sales from monthly sales data
  const calculateTotalSales = useCallback((rows: ProductRow[] = productRows) => {
    console.log("[v0] calculateTotalSales called with rows:", rows.length)
    
    const updatedRows = rows.map((row) => {
      if (!row || !row.monthly_sales) {
        return row
      }
      
      // Calculate total sales by summing all monthly sales values
      const totalSales = Object.values(row.monthly_sales).reduce((sum, monthSales) => {
        return sum + (typeof monthSales === 'number' ? monthSales : 0)
      }, 0)
      
      // Update the total_sales field
      const updatedRow = { ...row, total_sales: totalSales }
      
      return updatedRow
    })
    
    console.log("[v0] calculateTotalSales completed")
    return updatedRows
  }, [])

  const [filteredRows, setFilteredRows] = useState<ProductRow[]>([])

  // Function to fetch sales data from the database and update product rows
  const fetchSalesData = useCallback(async () => {
    if (!canUseSupabase() || productRows.length === 0) return

    try {
      console.log("[v0] Fetching sales data from database...")
      
      // Fetch all sales data
      const { data: salesData, error } = await supabase
        .from('sales')
        .select(`
          id,
          product_id,
          customer_id,
          warehouse_id,
          month,
          year,
          quantity,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)

      if (error) {
        console.error("Error fetching sales data:", error)
        return
      }

      if (!salesData || salesData.length === 0) {
        console.log("[v0] No sales data found")
        return
      }

      console.log("[v0] Fetched sales data:", salesData.length, "records")
      console.log("[v0] Raw sales data for debugging:", salesData)

      // Create aggregated sales data by product/warehouse combination (not including customer)
      // This ensures all rows with same product+warehouse get the total sales across all customers
      const salesAggregation: { [key: string]: { [monthKey: string]: number } } = {}
      
      salesData.forEach(sale => {
        // Handle both array and object types for nested relations
        const product = Array.isArray(sale.product) ? sale.product[0] : sale.product
        const customer = Array.isArray(sale.customer) ? sale.customer[0] : sale.customer
        const warehouse = Array.isArray(sale.warehouse) ? sale.warehouse[0] : sale.warehouse
        
        if (!product?.id || !warehouse?.id) return
        
        // Use product-warehouse combination (NOT including customer) for aggregation
        const combinationKey = `${product.id}-${warehouse.id}`
        const monthKey = getMonthKey(sale.month, sale.year)
        
        if (!monthKey) return
        
        if (!salesAggregation[combinationKey]) {
          salesAggregation[combinationKey] = {}
          months.forEach(({ key }) => {
            salesAggregation[combinationKey][key] = 0
          })
        }
        
        salesAggregation[combinationKey][monthKey] += sale.quantity || 0
        console.log(`[v0] Added sale: ${product.name} - ${customer?.name} - ${warehouse.name} for ${monthKey}: ${sale.quantity} (Total for ${combinationKey}: ${salesAggregation[combinationKey][monthKey]})`)
        
        // Special debug for CALPRO
        if (product.name === 'CALPRO' && warehouse.name === 'IGL' && monthKey === 'dec24') {
          console.log(`[DEBUG CALPRO] Sale added: ${customer?.name} = ${sale.quantity}, Running total: ${salesAggregation[combinationKey][monthKey]}`)
        }
      })

      console.log("[v0] Sales aggregation created:", Object.keys(salesAggregation).length, "unique combinations")
      // Log aggregation details
      Object.entries(salesAggregation).forEach(([key, monthlyData]) => {
        const totalSales = Object.values(monthlyData).reduce((sum, val) => sum + val, 0)
        if (totalSales > 0) {
          console.log(`[v0] Combination ${key} has total sales:`, totalSales, monthlyData)
        }
      })

      // Update ALL product rows with the same product/warehouse combination to have the same aggregated sales
      const updatedRows = productRows.map(row => {
        const updatedRow = { ...row }
        // Use product-warehouse combination (same as aggregation key)
        const combinationKey = `${row.product.id}-${row.warehouse.id}`
        
        // Use aggregated sales data if available, otherwise keep existing or set to zero
        if (salesAggregation[combinationKey]) {
          updatedRow.monthly_sales = { ...salesAggregation[combinationKey] }
          console.log(`[v0] Updated sales for ${row.product.name} - ${row.customer.name} - ${row.warehouse.name} using key ${combinationKey}:`, updatedRow.monthly_sales)
        } else {
          // Reset to zero if no sales data found
          const newMonthlySales: { [key: string]: number } = {}
          months.forEach(({ key }) => {
            newMonthlySales[key] = 0
          })
          updatedRow.monthly_sales = newMonthlySales
          console.log(`[v0] No sales data found for ${row.product.name} - ${row.warehouse.name}, setting to zero`)
        }
        
        return updatedRow
      })

      console.log("[v0] Updated product rows with sales data")
      setProductRows(updatedRows)
      
      // Recalculate stock values and total sales with updated sales data
      setTimeout(() => {
        const stockUpdatedRows = calculateStockValues(updatedRows)
        const finalRows = calculateTotalSales(stockUpdatedRows)
        setProductRows(finalRows)
      }, 100)

    } catch (error) {
      console.error("Error in fetchSalesData:", error)
    }
  }, [productRows, calculateStockValues, calculateTotalSales])

  // Helper function to convert month/year to our month key format
  const getMonthKey = (month: number, year: number): string | null => {
    const monthMapping: { [key: string]: string } = {
      '12-2024': 'dec24',
      '1-2025': 'jan25',
      '2-2025': 'feb25',
      '3-2025': 'mar25',
      '4-2025': 'apr25',
      '5-2025': 'may25',
      '6-2025': 'jun25',
      '7-2025': 'jul25',
      '8-2025': 'aug25',
      '9-2025': 'sep25',
      '10-2025': 'oct25',
      '11-2025': 'nov25',
      '12-2025': 'dec25'
    }
    
    const key = `${month}-${year}`
    return monthMapping[key] || null
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      // Start with empty data - users can add their own products
      const mockProductRows: ProductRow[] = []

      const mockCustomers: Customer[] = []

      const mockWarehouses: Warehouse[] = []

      setProductRows(mockProductRows)
      setCustomers(mockCustomers)
      setWarehouses(mockWarehouses)
      
      // Save to localStorage for persistence
      localStorage.setItem('inventoryProductData', JSON.stringify(mockProductRows))
      localStorage.setItem('inventoryCustomerData', JSON.stringify(mockCustomers))
      localStorage.setItem('inventoryWarehouseData', JSON.stringify(mockWarehouses))
      
      // Calculate stock values and total sales for the mock data
      setTimeout(() => {
        const stockUpdatedRows = calculateStockValues(mockProductRows)
        const finalRows = calculateTotalSales(stockUpdatedRows)
        setProductRows(finalRows)
      }, 100)
      
      toast({
        title: "Fresh Start",
        description: "Starting with empty data. Add your products, customers, and warehouses to get started.",
        duration: 3000,
      })
      
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error Loading Data",
        description: "Failed to load data. Please try refreshing the page.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setLoading(false)
    }
  }

  // Utility function to clear localStorage and reset component state
  const clearLocalStorageAndReset = useCallback(() => {
    console.log('[ProductManagement] Clearing localStorage and resetting component state')
    localStorage.removeItem('inventoryProductData')
    localStorage.removeItem('inventoryCustomerData')
    localStorage.removeItem('inventoryWarehouseData')
    
    setProductRows([])
    setCustomers([])
    setWarehouses([])
    setUndoStack([])
    setRedoStack([])
    setFilteredRows([])
    setLoading(true)
    
    // Close the confirmation dialog
    setShowResetConfirmation(false)
    
    toast({
      title: "Data Reset",
      description: "All data has been cleared and localStorage has been reset. Starting fresh...",
      duration: 3000,
    })
    
    // Fetch fresh data
    fetchData()
  }, [fetchData])

  // Function to clear FIN 90 specific data and reset calculations
  const clearFIN90Data = useCallback(() => {
    const updatedRows = productRows.map(row => {
      if (row.product.name === 'FIN 90') {
        // Reset all monthly data for FIN 90
        const resetRow = { ...row }
        months.forEach(month => {
          resetRow.monthly_opening_stock[month.key] = 0
          resetRow.monthly_closing_stock[month.key] = 0
          resetRow.monthly_sales[month.key] = 0
          resetRow.monthly_shipments[month.key] = []
        })
        resetRow.opening_stock = 0
        resetRow.closing_stock = 0
        resetRow.total_sales = 0
        return resetRow
      }
      return row
    })
    
    setProductRows(updatedRows)
    
    toast({
      title: "FIN 90 Data Reset",
      description: "FIN 90 data has been reset. You can now enter fresh opening stock and sales values.",
      duration: 3000,
    })
  }, [productRows, months])

  useEffect(() => {
    // Clear any existing sample data from localStorage
    const storedData = localStorage.getItem('inventoryProductData')
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData)
        // Check if the stored data contains sample data
        const hasSampleData = parsedData.some((row: any) => 
          row.product?.name === "Sample Product" || 
          row.customer?.name === "Sample Customer" || 
          row.warehouse?.name === "Sample Warehouse"
        )
        
        if (hasSampleData) {
          console.log('[ProductManagement] Found sample data in localStorage, clearing it...')
          localStorage.removeItem('inventoryProductData')
          localStorage.removeItem('inventoryCustomerData')
          localStorage.removeItem('inventoryWarehouseData')
          toast({
            title: "Sample Data Removed",
            description: "Cleared sample data from localStorage. Starting fresh.",
            duration: 3000,
          })
          // Fetch fresh empty data
          fetchData()
          return
        }
      } catch (error) {
        console.error('[ProductManagement] Error checking stored data:', error)
      }
    }
    
    // First try to load data from localStorage
    const currentStoredData = localStorage.getItem('inventoryProductData')
    const storedCustomers = localStorage.getItem('inventoryCustomerData')
    const storedWarehouses = localStorage.getItem('inventoryWarehouseData')
    
    let dataLoadedFromStorage = false
    
    if (currentStoredData && storedCustomers && storedWarehouses) {
      try {
        const parsedData = JSON.parse(currentStoredData)
        const parsedCustomers = JSON.parse(storedCustomers)
        const parsedWarehouses = JSON.parse(storedWarehouses)
        
        // Restore data from localStorage (including empty arrays)
        console.log('[ProductManagement] Restoring data from localStorage:', {
          productRows: parsedData.length,
          customers: parsedCustomers.length,
          warehouses: parsedWarehouses.length
        })
        
        setProductRows(parsedData)
        setCustomers(parsedCustomers)
        setWarehouses(parsedWarehouses)
        setLoading(false)
        dataLoadedFromStorage = true
        
        if (parsedData.length > 0) {
          toast({
            title: "Data Restored",
            description: `Successfully restored ${parsedData.length} product rows, ${parsedCustomers.length} customers, and ${parsedWarehouses.length} warehouses from localStorage.`,
            duration: 3000,
          })
        } else {
          toast({
            title: "Empty State Restored",
            description: "Restored empty state from localStorage. You can start adding products.",
            duration: 3000,
          })
        }
        
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
            let sales = updatedRow.monthly_sales[monthKey] || 0
            
            // Exclude direct shipment sales from stock calculations
            if (isDirectShipment(updatedRow.warehouse.name)) {
              sales = 0
            }
            
            const shipments = updatedRow.monthly_shipments[monthKey] || []
            const totalShipmentQuantity = shipments.reduce((sum: number, shipment: any) => sum + (shipment.quantity || 0), 0)
            
            // Calculate closing stock: Opening Stock + Shipments - Sales (excluding direct shipment sales)
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
        // Clear corrupted localStorage data
        localStorage.removeItem('inventoryProductData')
        localStorage.removeItem('inventoryCustomerData')
        localStorage.removeItem('inventoryWarehouseData')
        console.log('[ProductManagement] Cleared corrupted localStorage data, fetching fresh data')
      }
    }
    
    // If no stored data or error, fetch fresh data
    if (!dataLoadedFromStorage) {
      fetchData()
    }
  }, [selectedYear])

  // Save initial state to undo stack when data is first loaded
  useEffect(() => {
    if (productRows.length > 0 && undoStack.length === 0) {
      console.log("[v0] Saving initial state to undo stack")
      setUndoStack([JSON.parse(JSON.stringify(productRows))])
      
      // Calculate initial stock values and total sales to ensure proper chain calculation
      setTimeout(() => {
        const stockUpdatedRows = calculateStockValues(productRows)
        const finalRows = calculateTotalSales(stockUpdatedRows)
        setProductRows(finalRows)
      }, 100)
    }
  }, [productRows, undoStack.length, calculateStockValues, calculateTotalSales])

  useEffect(() => {
    // Apply search filter whenever searchQuery or productRows change
    const newFilteredRows = productRows.filter((row) => {
      if (!searchQuery.trim()) return true
      
      // Handle OR logic for multiple filter values
      const searchTerms = searchQuery.split(" OR ").map(term => term.trim().toLowerCase())
      
      return searchTerms.some(term => 
        row.product?.name?.toLowerCase().includes(term) ||
        row.customer?.name?.toLowerCase().includes(term) ||
        row.warehouse?.name?.toLowerCase().includes(term)
      )
    })
    setFilteredRows(newFilteredRows)
  }, [searchQuery, productRows])

  useEffect(() => {
    // Update localStorage whenever productRows changes so other tabs can access updated data
    // Save even when array is empty to ensure deletions are persisted
    console.log('[ProductManagement] productRows changed, length:', productRows.length)
    localStorage.setItem('inventoryProductData', JSON.stringify(productRows))
    // Dispatch custom event to notify other components in the same window
    console.log('[ProductManagement] Dispatching localStorageChange event, productRows length:', productRows.length)
    const event = new Event('localStorageChange')
    window.dispatchEvent(event)
    console.log('[ProductManagement] Event dispatched successfully')
    
    // Show toast notification for successful save (but only when not in initial load)
    if (undoStack.length > 0) {
      toast({
        title: "Data Saved",
        description: `Successfully saved ${productRows.length} product rows to localStorage.`,
        duration: 2000,
      })
    }
  }, [productRows, undoStack.length, toast])

  // Fetch sales data from database when product rows are available
  useEffect(() => {
    if (productRows.length > 0 && canUseSupabase()) {
      console.log('[ProductManagement] Product rows available, fetching sales data...')
      fetchSalesData()
    }
  }, [productRows.length, fetchSalesData])


  // Set up interval to periodically sync sales data
  useEffect(() => {
    if (!canUseSupabase()) return

    const interval = setInterval(() => {
      if (productRows.length > 0) {
        console.log('[ProductManagement] Periodic sales data sync...')
        fetchSalesData()
      }
    }, 30000) // Sync every 30 seconds

    return () => clearInterval(interval)
  }, [productRows.length, fetchSalesData])

  // Listen for sales data changes from sales management component
  useEffect(() => {
    const handleSalesUpdate = () => {
      console.log('[ProductManagement] Received sales update event, fetching latest sales data...')
      if (productRows.length > 0 && canUseSupabase()) {
        fetchSalesData()
      }
    }

    window.addEventListener('salesDataUpdate', handleSalesUpdate)
    return () => window.removeEventListener('salesDataUpdate', handleSalesUpdate)
  }, [productRows.length, fetchSalesData])

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

  // Extract unique customers from productRows and update customers state
  useEffect(() => {
    const extractUniqueCustomers = () => {
      const uniqueCustomerNames = new Set<string>()
      const customerMap = new Map<string, Customer>()

      // Extract unique customer names from productRows
      productRows.forEach(row => {
        if (row.customer.name && row.customer.name.trim()) {
          const customerName = row.customer.name.trim()
          uniqueCustomerNames.add(customerName)
          
          // Create or update customer object
          if (!customerMap.has(customerName)) {
            customerMap.set(customerName, {
              id: row.customer.id || `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: customerName
            })
          }
        }
      })

      // Convert to array
      const extractedCustomers = Array.from(customerMap.values())
      
      // Only update if customers have actually changed
      const currentCustomerNames = new Set(customers.map(c => c.name))
      const newCustomerNames = new Set(extractedCustomers.map(c => c.name))
      
      const hasChanges = currentCustomerNames.size !== newCustomerNames.size || 
        !Array.from(currentCustomerNames).every(name => newCustomerNames.has(name))
      
      if (hasChanges) {
        console.log('[ProductManagement] Updating customers from productRows:', extractedCustomers.length, 'unique customers')
        setCustomers(extractedCustomers)
      }
    }

    // Only extract customers if we have productRows
    if (productRows.length > 0) {
      extractUniqueCustomers()
    }
  }, [productRows, customers])

  // Save customers to localStorage and database whenever they change
  useEffect(() => {
    const saveCustomers = async () => {
      if (customers.length > 0) {
        // Save to localStorage
        localStorage.setItem('inventoryCustomerData', JSON.stringify(customers))
        
        // Save to database if available
        if (canUseSupabase()) {
          try {
            console.log('[ProductManagement] Saving customers to database:', customers.length, 'customers')
            
            // Upsert customers to database
            for (const customer of customers) {
              await supabase
                .from('customers')
                .upsert({
                  id: customer.id,
                  name: customer.name
                }, {
                  onConflict: 'name'
                })
            }
            
            console.log('[ProductManagement] Successfully saved customers to database')
            
            // Dispatch event to notify dashboard to refresh
            window.dispatchEvent(new Event('localStorageChange'))
            
          } catch (error) {
            console.error('[ProductManagement] Error saving customers to database:', error)
          }
        }
        
        // Only show toast if this isn't the initial load
        if (undoStack.length > 0) {
          toast({
            title: "Customers Saved",
            description: `Successfully saved ${customers.length} customers to localStorage and database.`,
            duration: 2000,
          })
        }
      }
    }

    saveCustomers()
  }, [customers, undoStack.length, toast])

  // Extract unique warehouses from productRows and update warehouses state
  useEffect(() => {
    const extractUniqueWarehouses = () => {
      const uniqueWarehouseNames = new Set<string>()
      const warehouseMap = new Map<string, Warehouse>()

      // Extract unique warehouse names from productRows
      productRows.forEach(row => {
        if (row.warehouse.name && row.warehouse.name.trim()) {
          const warehouseName = row.warehouse.name.trim()
          uniqueWarehouseNames.add(warehouseName)
          
          // Create or update warehouse object
          if (!warehouseMap.has(warehouseName)) {
            warehouseMap.set(warehouseName, {
              id: row.warehouse.id || `warehouse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: warehouseName
            })
          }
        }
      })

      // Convert to array
      const extractedWarehouses = Array.from(warehouseMap.values())
      
      // Only update if warehouses have actually changed
      const currentWarehouseNames = new Set(warehouses.map(w => w.name))
      const newWarehouseNames = new Set(extractedWarehouses.map(w => w.name))
      
      const hasChanges = currentWarehouseNames.size !== newWarehouseNames.size || 
        !Array.from(currentWarehouseNames).every(name => newWarehouseNames.has(name))
      
      if (hasChanges) {
        console.log('[ProductManagement] Updating warehouses from productRows:', extractedWarehouses.length, 'unique warehouses')
        setWarehouses(extractedWarehouses)
      }
    }

    // Only extract warehouses if we have productRows
    if (productRows.length > 0) {
      extractUniqueWarehouses()
    }
  }, [productRows, warehouses])

  // Save warehouses to localStorage and database whenever they change
  useEffect(() => {
    const saveWarehouses = async () => {
      if (warehouses.length > 0) {
        // Save to localStorage
        localStorage.setItem('inventoryWarehouseData', JSON.stringify(warehouses))
        
        // Save to database if available
        if (canUseSupabase()) {
          try {
            console.log('[ProductManagement] Saving warehouses to database:', warehouses.length, 'warehouses')
            
            // Upsert warehouses to database
            for (const warehouse of warehouses) {
              await supabase
                .from('warehouses')
                .upsert({
                  id: warehouse.id,
                  name: warehouse.name
                }, {
                  onConflict: 'name'
                })
            }
            
            console.log('[ProductManagement] Successfully saved warehouses to database')
            
            // Dispatch event to notify dashboard to refresh
            window.dispatchEvent(new Event('localStorageChange'))
            
          } catch (error) {
            console.error('[ProductManagement] Error saving warehouses to database:', error)
          }
        }
        
        // Only show toast if this isn't the initial load
        if (undoStack.length > 0) {
          toast({
            title: "Warehouses Saved",
            description: `Successfully saved ${warehouses.length} warehouses to localStorage and database.`,
            duration: 2000,
          })
        }
      }
    }

    saveWarehouses()
  }, [warehouses, toast])

  // Reset undo stack when data is restored from localStorage
  useEffect(() => {
    if (productRows.length > 0 && undoStack.length === 0) {
      console.log('[ProductManagement] Resetting undo stack for restored data')
      setUndoStack([JSON.parse(JSON.stringify(productRows))])
      setRedoStack([])
      
      toast({
        title: "Undo Stack Reset",
        description: "Undo/redo functionality is now available for your restored data.",
        duration: 2000,
      })
    }
  }, [productRows, undoStack.length, toast])

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

    // Group all rows by product name AND warehouse name
    const productGroups: { [key: string]: ProductRow[] } = {}

    rows.forEach((row) => {
      // Skip rows with undefined product, but allow empty strings
      if (
        !row ||
        row.product === undefined ||
        row.product === null
      ) {
        console.log("[v0] Skipping row with undefined product:", row)
        return
      }

      const productName = row.product.name || ""
      const warehouseName = row.warehouse?.name || ""
      
      // Create a unique key using product name AND warehouse name
      const groupKey = `${productName}|${warehouseName}`
      
      if (!productGroups[groupKey]) {
        productGroups[groupKey] = []
      }
      productGroups[groupKey].push(row)
    })

    console.log("[v0] Grouped rows by product-warehouse:", Object.keys(productGroups))
    return productGroups
  }, [])

  const calculateConsolidatedStock = (groupRows: ProductRow[]) => {
    console.log(`[DEBUG FIX] calculateConsolidatedStock called with ${groupRows.length} rows:`)
    groupRows.forEach((row, idx) => {
      console.log(`[DEBUG FIX]   Row ${idx}: ${row.product?.name}-${row.customer?.name}-${row.warehouse?.name}`)
    })
    
    const consolidatedOpeningStock: { [key: string]: number } = {}
    const consolidatedClosingStock: { [key: string]: number } = {}

    months.forEach(({ key }, monthIndex) => {
      // For the first month (Dec 24), only take opening stock from the first row to avoid double counting
      if (monthIndex === 0) {
        console.log(`[DEBUG FIX] Calculating consolidated opening stock for ${key}:`)
        
        // Check if there's a manual input value that should be used
        const firstRow = groupRows[0]
        if (firstRow) {
          const inputKey = `${firstRow.product.name}-${firstRow.warehouse.name}-${key}`
          const manualInputValue = openingStockInputs[inputKey]
          
          if (manualInputValue && manualInputValue !== "" && manualInputValue !== "0") {
            // Use manual input value
            consolidatedOpeningStock[key] = parseFloat(manualInputValue) || 0
            console.log(`[DEBUG FIX] Using manual input for opening stock: ${consolidatedOpeningStock[key]}`)
          } else {
            // Use only the first row's opening stock value to avoid double counting
            consolidatedOpeningStock[key] = (firstRow.monthly_opening_stock && firstRow.monthly_opening_stock[key]) || 0
            console.log(`[DEBUG FIX] Using first row's opening stock: ${consolidatedOpeningStock[key]}`)
          }
        } else {
          consolidatedOpeningStock[key] = 0
        }
        
        // Debug all rows to see what they have
        groupRows.forEach((row, rowIndex) => {
          if (row && row.monthly_opening_stock) {
            const value = row.monthly_opening_stock[key] || 0
            console.log(`[DEBUG FIX]   Row ${rowIndex} (${row.customer?.name}): opening stock = ${value}`)
          }
        })
        console.log(`[DEBUG FIX] Final consolidated opening stock for ${key}: ${consolidatedOpeningStock[key]}`)
      } else {
        // For subsequent months, use the previous month's closing stock as opening stock
        const prevMonthKey = months[monthIndex - 1].key
        consolidatedOpeningStock[key] = consolidatedClosingStock[prevMonthKey] || 0
        
        console.log(`[DEBUG FIX] Carry-forward for ${key}: using closing stock from ${prevMonthKey} = ${consolidatedOpeningStock[key]}`)
      }

      // Calculate consolidated closing stock using the formula: Consolidated Opening + Consolidated Shipments - Consolidated Sales
      const consolidatedShipments = groupRows.reduce((sum, row) => {
        if (!row || !row.monthly_shipments) return sum
        const monthShipments = row.monthly_shipments[key] || []
        const rowShipments = monthShipments.reduce((shipmentSum, shipment) => shipmentSum + (shipment.quantity || 0), 0)
        return sum + rowShipments
      }, 0)

      const consolidatedSales = groupRows.reduce((sum, row) => {
        if (!row || !row.monthly_sales) return sum
        const value = row.monthly_sales[key] || 0
        
        // Exclude direct shipment sales from consolidated stock calculations
        if (isDirectShipment(row.warehouse.name)) {
          console.log(`[DEBUG FIX] Excluding direct shipment sales from consolidated calculation: ${row.warehouse.name}`)
          return sum
        }
        
        return sum + value
      }, 0)

      // Use the formula: Opening + Shipments - Sales
      consolidatedClosingStock[key] = consolidatedOpeningStock[key] + consolidatedShipments - consolidatedSales
      
      // Debug logging for the specific case
      if (consolidatedOpeningStock[key] === 105125 || key === 'dec24') {
        console.log(`[DEBUG FIX] Consolidation for ${key}:`)
        console.log(`[DEBUG FIX] Consolidated Opening: ${consolidatedOpeningStock[key]}`)
        console.log(`[DEBUG FIX] Consolidated Shipments: ${consolidatedShipments}`)
        console.log(`[DEBUG FIX] Consolidated Sales: ${consolidatedSales}`)
        console.log(`[DEBUG FIX] Consolidated Closing: ${consolidatedOpeningStock[key]} + ${consolidatedShipments} - ${consolidatedSales} = ${consolidatedClosingStock[key]}`)
        
        // Debug the individual rows contributing to consolidation
        console.log(`[DEBUG FIX] Individual rows for ${key}:`)
        groupRows.forEach((row, idx) => {
          if (row && row.monthly_shipments) {
            const monthShipments = row.monthly_shipments[key] || []
            const rowShipments = monthShipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
            const rowSales = row.monthly_sales ? (row.monthly_sales[key] || 0) : 0
            const rowOpening = row.monthly_opening_stock ? (row.monthly_opening_stock[key] || 0) : 0
            console.log(`[DEBUG FIX]   Row ${idx} (${row.customer?.name}): Opening=${rowOpening}, Shipments=${rowShipments}, Sales=${rowSales}`)
          }
        })
      }
    })

    return { consolidatedOpeningStock, consolidatedClosingStock }
  }

  const updateGroupOpeningStock = (productName: string, warehouseName: string, monthKey: string, value: string) => {
    const numValue = Number.parseFloat(value) || 0
    
    console.log(`[DEBUG FIX] updateGroupOpeningStock called: ${productName}-${warehouseName}-${monthKey} = ${numValue}`)


    
    // Update local input state - use the same key format as the input rendering
    const inputKey = `${productName}-${warehouseName}-${monthKey}`
    console.log(`[DEBUG FIX] Setting manual input: ${inputKey} = ${value}`)
    setOpeningStockInputs(prev => ({
      ...prev,
      [inputKey]: value
    }))
    

    
    saveToUndoStack(productRows)

    // Find all rows with the same product name (regardless of warehouse)
    const matchingRowIndices: number[] = []
    productRows.forEach((row, index) => {
      if (row.product.name.toLowerCase() === productName.toLowerCase()) {
        matchingRowIndices.push(index)
      }
    })

    const updatedRows = productRows.map((row, index) => {
      if (row.product.name.toLowerCase() === productName.toLowerCase()) {
        // Only set the opening stock on the FIRST row found for this product
        // Set all other rows to 0 to avoid double counting in consolidation
        const isFirstRow = index === matchingRowIndices[0]
        const openingStockValue = isFirstRow ? numValue : 0
        
        console.log(`[DEBUG FIX] updateGroupOpeningStock - Row ${index} (${row.customer.name}): isFirstRow=${isFirstRow}, openingStock=${openingStockValue}`)
        
        return {
          ...row,
          monthly_opening_stock: {
            ...row.monthly_opening_stock,
            [monthKey]: openingStockValue,
          },
        }
      }
      return row
    })

    // Recalculate closing stock for affected rows using the new formula
    const calculateStockForRowInGroup = (rows: ProductRow[], rowIndex: number) => {
      const row = rows[rowIndex]

      // Calculate closing stock for each month and carry forward to next month
      months.forEach((month, monthIndex) => {
        const currentMonthKey = month.key

        // Get values for calculation
        const openingStock = row.monthly_opening_stock[currentMonthKey] || 0
        let sales = row.monthly_sales[currentMonthKey] || 0

        // Exclude direct shipment sales from stock calculations
        if (isDirectShipment(row.warehouse.name)) {
          console.log(`[DEBUG FIX] Excluding direct shipment sales from row calculation: ${row.warehouse.name}`)
          sales = 0
        }

        // Calculate total shipment quantity for this month
        const shipments = row.monthly_shipments[currentMonthKey] || []
        const totalShipmentQuantity = shipments.reduce((sum, shipment) => sum + shipment.quantity, 0)

        // Calculate closing stock: Opening Stock + Shipments - Sales (excluding direct shipment sales)
        const closingStock = openingStock + totalShipmentQuantity - sales
        row.monthly_closing_stock[currentMonthKey] = closingStock
        
        // Debug logging for the specific case
        if (openingStock === 105125) {
          console.log(`[DEBUG FIX] Row calculation for ${row.product.name}-${row.warehouse.name}-${currentMonthKey}:`)
          console.log(`[DEBUG FIX] Opening: ${openingStock}, Shipments: ${totalShipmentQuantity}, Sales: ${sales}`)
          console.log(`[DEBUG FIX] Closing: ${openingStock} + ${totalShipmentQuantity} - ${sales} = ${closingStock}`)
        }

        // Only carry forward closing stock to next month's opening stock for the first row of each product-warehouse group
        // This prevents multiple rows from each contributing to the next month's opening stock
        if (monthIndex < months.length - 1) {
          const nextMonthKey = months[monthIndex + 1].key
          
          // Find all rows with the same product name
          const sameGroupRows = rows.filter(r => 
            r.product.name.toLowerCase() === row.product.name.toLowerCase()
          )
          const isFirstRowInGroup = sameGroupRows[0] === row
          
          if (isFirstRowInGroup) {
            // Calculate the consolidated closing stock for this group for carry-forward
            const consolidatedClosingStock = sameGroupRows.reduce((sum, groupRow) => {
              return sum + (groupRow.monthly_closing_stock[currentMonthKey] || 0)
            }, 0)
            
            // Set the consolidated closing stock as opening stock for the next month on the first row only
            row.monthly_opening_stock[nextMonthKey] = consolidatedClosingStock
            
            // Set opening stock to 0 for all other rows in the group for the next month
            sameGroupRows.slice(1).forEach(otherRow => {
              otherRow.monthly_opening_stock[nextMonthKey] = 0
            })
            
            // Update the opening stock input for the next month to show the calculated value
            // Only update if there's no existing manual input for the next month
            const inputKey = `${row.product.name}-${nextMonthKey}`
            setOpeningStockInputs(prev => {
              // Don't override if user has manually entered a meaningful value for the next month
              // Allow override of default/placeholder values like "-1", "0", or empty strings
              const currentValue = prev[inputKey]
              const isPlaceholderValue = !currentValue || currentValue === "" || currentValue === "0" || currentValue === "-1"
              
              console.log(`[DEBUG FIX] Carry-forward check for ${inputKey}: currentValue="${currentValue}", consolidatedClosingStock=${consolidatedClosingStock}, isPlaceholder=${isPlaceholderValue}`)
              
              // Always allow carry-forward to override - the user can always manually change it later
              console.log(`[DEBUG FIX] Carrying forward to ${inputKey}: ${consolidatedClosingStock} (was: ${currentValue})`)
              return {
                ...prev,
                [inputKey]: consolidatedClosingStock.toString()
              }
            })
          }
        }
      })
    }

    // Only recalculate for the first row (which has the opening stock)
    // The other rows will have 0 opening stock and their closing stock will be calculated based on their individual shipments/sales
    updatedRows.forEach((row, rowIndex) => {
      if (
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
      ) {
        calculateStockForRowInGroup(updatedRows, rowIndex)
      }
    })


    setProductRows(updatedRows)
    
    // Trigger a re-render to update the UI
    setStockUpdateTrigger(prev => prev + 1)
  }

  // This useEffect was removed to prevent duplicate data fetching

  // Initialize opening stock inputs from existing data
  useEffect(() => {
    const initialInputs: { [key: string]: string } = {}
    productRows.forEach(row => {
      months.forEach(({ key }) => {
        const inputKey = `${row.product.name}-${row.warehouse.name}-${key}`
        if (row.monthly_opening_stock[key] !== undefined) {
          initialInputs[inputKey] = row.monthly_opening_stock[key].toString()
        }
      })
    })
    setOpeningStockInputs(prev => {
      // Only update inputs that don't already have manual values
      const newInputs = { ...prev }
      Object.entries(initialInputs).forEach(([key, value]) => {
        const currentValue = newInputs[key]
        const isPlaceholderValue = !currentValue || currentValue === "" || currentValue === "0" || currentValue === "-1"
        
        // Only set if it's a placeholder value or if there's no existing meaningful manual input
        if (isPlaceholderValue || parseFloat(currentValue) <= 0) {
          newInputs[key] = value
        }
      })
      return newInputs
    })
  }, [productRows])

  // Force re-render when stock values change
  useEffect(() => {
    // This will force the component to re-render
  }, [stockUpdateTrigger])

  // Test function to verify calculation consistency
  const testCalculationConsistency = (productName: string, warehouseName: string, monthKey: string) => {
    console.log(`[TEST] Testing calculation consistency for ${productName} - ${warehouseName} - ${monthKey}`)
    
    const matchingRows = productRows.filter(row => 
      row.product.name.toLowerCase() === productName.toLowerCase() &&
      row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
    )
    
    if (matchingRows.length === 0) {
      console.log(`[TEST] No rows found for ${productName} - ${warehouseName}`)
      return
    }
    
    // Get consolidated values
    const consolidatedOpeningStock = matchingRows[0]?.monthly_opening_stock[monthKey] || 0
    const consolidatedSales = matchingRows.reduce((sum, row) => sum + (row.monthly_sales[monthKey] || 0), 0)
    const consolidatedShipments = matchingRows.reduce((sum, row) => {
      const rowShipments = row.monthly_shipments[monthKey] || []
      return sum + rowShipments.reduce((rowSum, shipment) => rowSum + (shipment.quantity || 0), 0)
    }, 0)
    const consolidatedClosingStock = matchingRows[0]?.monthly_closing_stock[monthKey] || 0
    
    const expectedClosingStock = consolidatedOpeningStock + consolidatedShipments - consolidatedSales
    
    console.log(`[TEST] Consolidated Opening Stock: ${consolidatedOpeningStock}`)
    console.log(`[TEST] Consolidated Sales: ${consolidatedSales}`)
    console.log(`[TEST] Consolidated Shipments: ${consolidatedShipments}`)
    console.log(`[TEST] Current Closing Stock: ${consolidatedClosingStock}`)
    console.log(`[TEST] Expected Closing Stock: ${expectedClosingStock}`)
    console.log(`[TEST] Calculation: ${consolidatedOpeningStock} + ${consolidatedShipments} - ${consolidatedSales} = ${expectedClosingStock}`)
    console.log(`[TEST] Difference: ${consolidatedClosingStock - expectedClosingStock}`)
    
    if (Math.abs(consolidatedClosingStock - expectedClosingStock) > 0.01) {
      console.log(`[TEST] ❌ CALCULATION INCONSISTENCY DETECTED!`)
    } else {
      console.log(`[TEST] ✅ Calculation is consistent`)
    }
    
    return {
      openingStock: consolidatedOpeningStock,
      sales: consolidatedSales,
      shipments: consolidatedShipments,
      currentClosingStock: consolidatedClosingStock,
      expectedClosingStock,
      isConsistent: Math.abs(consolidatedClosingStock - expectedClosingStock) <= 0.01
    }
  }

  // Debug function to help troubleshoot calculation issues
  const debugStockCalculation = (productName: string, customerName: string, warehouseName: string, monthKey: string) => {
    const row = productRows.find(r => 
      r.product.name.toLowerCase() === productName.toLowerCase() &&
      r.customer.name.toLowerCase() === customerName.toLowerCase() &&
      r.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
    )
    
    if (!row) {
      console.log(`[DEBUG] Row not found for ${productName} - ${customerName} - ${warehouseName}`)
      return
    }
    
    const openingStock = row.monthly_opening_stock[monthKey] || 0
    const sales = row.monthly_sales[monthKey] || 0
    const shipments = row.monthly_shipments[monthKey] || []
    const totalShipmentQuantity = shipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
    const currentClosingStock = row.monthly_closing_stock[monthKey] || 0
    const expectedClosingStock = openingStock + totalShipmentQuantity - sales
    
    console.log(`[DEBUG] Stock calculation breakdown for ${monthKey}:`)
    console.log(`  Product: ${row.product.name}`)
    console.log(`  Customer: ${row.customer.name}`)
    console.log(`  Warehouse: ${row.warehouse.name}`)
    console.log(`  Opening Stock: ${openingStock}`)
    console.log(`  Sales: ${sales}`)
    console.log(`  Shipments: ${totalShipmentQuantity}`)
    console.log(`  Individual Shipments:`, shipments.map(s => ({ number: s.shipment_number, quantity: s.quantity })))
    console.log(`  Current Closing Stock: ${currentClosingStock}`)
    console.log(`  Expected Closing Stock: ${openingStock} + ${totalShipmentQuantity} - ${sales} = ${expectedClosingStock}`)
    console.log(`  Difference: ${currentClosingStock - expectedClosingStock}`)
    
    return { openingStock, sales, totalShipmentQuantity, currentClosingStock, expectedClosingStock }
  }

  // Force recalculation for a specific row
  const forceRecalculateRow = (productName: string, customerName: string, warehouseName: string) => {
    console.log(`[DEBUG] Forcing recalculation for ${productName} - ${customerName} - ${warehouseName}`)
    
    const updatedRows = productRows.map(row => {
      if (
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.customer.name.toLowerCase() === customerName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
      ) {
        console.log(`[DEBUG] Found row, recalculating...`)
        const stockUpdatedRow = calculateStockValues([row])[0]
        return calculateTotalSales([stockUpdatedRow])[0]
      }
      return row
    })
    
    setProductRows(updatedRows)
    setStockUpdateTrigger(prev => prev + 1)
    console.log(`[DEBUG] Recalculation complete`)
  }

  // Make debug functions available in browser console
  useEffect(() => {
    (window as any).debugStockCalculation = debugStockCalculation
    ;(window as any).testCalculationConsistency = testCalculationConsistency
    ;(window as any).forceRecalculateRow = forceRecalculateRow
    ;(window as any).getProductRows = () => productRows
    ;(window as any).clearAllData = () => {
      console.log('[DEBUG] Clearing all data and starting fresh')
      localStorage.clear()
      setProductRows([])
      setCustomers([])
      setWarehouses([])
      setUndoStack([])
      setRedoStack([])
      console.log('[DEBUG] All data cleared - ready for fresh input')
    }
    ;(window as any).fetchSalesData = fetchSalesData
    ;(window as any).debugCALPRO = () => {
      console.log('[DEBUG] CALPRO rows:', productRows.filter(row => row.product.name === 'CALPRO'))
    }
    
    ;(window as any).forceClearMockData = () => {
      console.log('[DEBUG] Force clearing all mock data')
      
      // Clear all state
      setProductRows([])
      setCustomers([])
      setWarehouses([])
      setUndoStack([])
      setRedoStack([])
      
      // Clear localStorage
      localStorage.clear()
      
      // Force reload to ensure clean state
      console.log('[DEBUG] Mock data cleared - reloading page for clean start')
      window.location.reload()
    }
    ;(window as any).findRowByValues = (openingStock: number, sales: number, shipments: number) => {
      console.log(`[DEBUG] Searching for row with Opening=${openingStock}, Sales=${sales}, Shipments=${shipments}`)
      const foundRows = productRows.filter(row => {
        const hasMatchingValues = Object.keys(row.monthly_opening_stock).some(monthKey => {
          const opening = row.monthly_opening_stock[monthKey] || 0
          const sales = row.monthly_sales[monthKey] || 0
          const totalShipments = (row.monthly_shipments[monthKey] || []).reduce((sum, s) => sum + (s.quantity || 0), 0)
          return Math.abs(opening - openingStock) < 1 && Math.abs(sales - sales) < 1 && Math.abs(totalShipments - shipments) < 1
        })
        return hasMatchingValues
      })
      
      if (foundRows.length > 0) {
        console.log(`[DEBUG] Found ${foundRows.length} matching rows:`, foundRows)
        return foundRows
      } else {
        console.log(`[DEBUG] No rows found with those exact values`)
        // Show all rows for debugging
        console.log(`[DEBUG] All current rows:`, productRows.map(r => ({
          product: r.product.name,
          customer: r.customer.name,
          warehouse: r.warehouse.name,
          monthly_data: Object.keys(r.monthly_opening_stock).map(month => ({
            month,
            opening: r.monthly_opening_stock[month] || 0,
            sales: r.monthly_sales[month] || 0,
            shipments: (r.monthly_shipments[month] || []).reduce((sum, s) => sum + (s.quantity || 0), 0),
            closing: r.monthly_closing_stock[month] || 0
          }))
        })))
        return []
      }
    }
    
      // Function to debug consolidated stock calculation
  ;(window as any).debugConsolidatedStock = (productName: string, warehouseName: string, monthKey: string) => {
    console.log(`[DEBUG] Consolidated stock calculation for ${productName} - ${warehouseName} - ${monthKey}`)
    
    // Find all rows for this product and warehouse
    const matchingRows = productRows.filter(row => 
      row.product.name.toLowerCase() === productName.toLowerCase() &&
      row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
    )
    
    console.log(`[DEBUG] Found ${matchingRows.length} rows for ${productName} - ${warehouseName}`)
    
    // Calculate totals
    const totalSales = matchingRows.reduce((sum, row) => sum + (row.monthly_sales[monthKey] || 0), 0)
    const totalShipments = matchingRows.reduce((sum, row) => {
      const rowShipments = row.monthly_shipments[monthKey] || []
      return sum + rowShipments.reduce((rowSum, shipment) => rowSum + (shipment.quantity || 0), 0)
    }, 0)
    
    // Get the consolidated opening stock (should be the same for all rows)
    const consolidatedOpeningStock = matchingRows[0]?.monthly_opening_stock[monthKey] || 0
    const consolidatedClosingStock = matchingRows[0]?.monthly_closing_stock[monthKey] || 0
    
    console.log(`[DEBUG] Consolidated totals for ${monthKey}:`)
    console.log(`  Opening Stock: ${consolidatedOpeningStock}`)
    console.log(`  Total Sales: ${totalSales}`)
    console.log(`  Total Shipments: ${totalShipments}`)
    console.log(`  Current Closing Stock: ${consolidatedClosingStock}`)
    console.log(`  Expected Closing Stock: ${consolidatedOpeningStock} + ${totalShipments} - ${totalSales} = ${consolidatedOpeningStock + totalShipments - totalSales}`)
    
    // Show individual row breakdowns
    matchingRows.forEach((row, index) => {
      const rowSales = row.monthly_sales[monthKey] || 0
      const rowShipments = (row.monthly_shipments[monthKey] || []).reduce((sum, s) => sum + (s.quantity || 0), 0)
      console.log(`  Row ${index + 1}: ${row.customer.name} - Sales: ${rowSales}, Shipments: ${rowShipments}`)
    })
    
    return {
      openingStock: consolidatedOpeningStock,
      totalSales,
      totalShipments,
      currentClosingStock: consolidatedClosingStock,
      expectedClosingStock: consolidatedOpeningStock + totalShipments - totalSales
    }
  }

  // Function to force fix consolidated stock calculation
  ;(window as any).forceFixConsolidatedStock = (productName: string, warehouseName: string, monthKey: string) => {
    console.log(`[DEBUG] Force fixing consolidated stock for ${productName} - ${warehouseName} - ${monthKey}`)
    
    // Find all rows for this product and warehouse
    const matchingRows = productRows.filter(row => 
      row.product.name.toLowerCase() === productName.toLowerCase() &&
      row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
    )
    
    if (matchingRows.length === 0) {
      console.log(`[DEBUG] No rows found for ${productName} - ${warehouseName}`)
      return
    }
    
    // Calculate correct totals
    const totalSales = matchingRows.reduce((sum, row) => sum + (row.monthly_sales[monthKey] || 0), 0)
    const totalShipments = matchingRows.reduce((sum, row) => {
      const rowShipments = row.monthly_shipments[monthKey] || []
      return sum + rowShipments.reduce((rowSum, shipment) => rowSum + (shipment.quantity || 0), 0)
    }, 0)
    
    const openingStock = matchingRows[0].monthly_opening_stock[monthKey] || 0
    const correctClosingStock = openingStock + totalShipments - totalSales
    
    console.log(`[DEBUG] Correct calculation: ${openingStock} + ${totalShipments} - ${totalSales} = ${correctClosingStock}`)
    
    // Update ALL rows with the correct closing stock
    const updatedRows = productRows.map(row => {
      if (
        row.product.name.toLowerCase() === productName.toLowerCase() &&
        row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
      ) {
        // Update the closing stock for this month
        row.monthly_closing_stock[monthKey] = correctClosingStock
        
        // Also update opening stock for next month if it exists
        const monthIndex = months.findIndex(m => m.key === monthKey)
        if (monthIndex >= 0 && monthIndex < months.length - 1) {
          const nextMonthKey = months[monthIndex + 1].key
          row.monthly_opening_stock[nextMonthKey] = correctClosingStock
        }
      }
      return row
    })
    
    // Update the state
    setProductRows(updatedRows)
    setStockUpdateTrigger(prev => prev + 1)
    
    console.log(`[DEBUG] Force fix complete. Closing stock updated to: ${correctClosingStock}`)
    return correctClosingStock
  }
    
    return () => {
      delete (window as any).debugStockCalculation
      delete (window as any).forceRecalculateRow
      delete (window as any).getProductRows
      delete (window as any).findRowByValues
      delete (window as any).debugConsolidatedStock
      delete (window as any).forceFixConsolidatedStock
      delete (window as any).clearAllData
      delete (window as any).forceClearMockData
    }
    
    // Function to manually fix a specific calculation
    ;(window as any).fixCalculation = (productName: string, customerName: string, warehouseName: string, monthKey: string, correctOpeningStock: number, correctSales: number, correctShipments: number) => {
      console.log(`[DEBUG] Manually fixing calculation for ${productName} - ${customerName} - ${warehouseName} - ${monthKey}`)
      
      const updatedRows = productRows.map(row => {
        if (
          row.product.name.toLowerCase() === productName.toLowerCase() &&
          row.customer.name.toLowerCase() === customerName.toLowerCase() &&
          row.warehouse.name.toLowerCase() === warehouseName.toLowerCase()
        ) {
          console.log(`[DEBUG] Found row, updating values...`)
          
          // Update the values
          row.monthly_opening_stock[monthKey] = correctOpeningStock
          row.monthly_sales[monthKey] = correctSales
          
          // Clear existing shipments and add the correct one
          row.monthly_shipments[monthKey] = [{
            shipment_number: `FIXED-${Date.now()}`,
            quantity: correctShipments
          }]
          
          // Calculate correct closing stock
          const correctClosingStock = correctOpeningStock + correctShipments - correctSales
          row.monthly_closing_stock[monthKey] = correctClosingStock
          
          console.log(`[DEBUG] Updated values: Opening=${correctOpeningStock}, Sales=${correctSales}, Shipments=${correctShipments}, Closing=${correctClosingStock}`)
          
          // Now recalculate all subsequent months
          const monthIndex = months.findIndex(m => m.key === monthKey)
          if (monthIndex >= 0 && monthIndex < months.length - 1) {
            let currentOpeningStock = correctClosingStock
            
            for (let i = monthIndex + 1; i < months.length; i++) {
              const subsequentMonthKey = months[i].key
              const subsequentSales = row.monthly_sales[subsequentMonthKey] || 0
              const subsequentShipments = row.monthly_shipments[subsequentMonthKey] || []
              const subsequentTotalShipments = subsequentShipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
              const subsequentClosingStock = currentOpeningStock + subsequentTotalShipments - subsequentSales
              
              row.monthly_opening_stock[subsequentMonthKey] = currentOpeningStock
              row.monthly_closing_stock[subsequentMonthKey] = subsequentClosingStock
              
              console.log(`[DEBUG] Updated ${subsequentMonthKey}: Opening=${currentOpeningStock}, Closing=${subsequentClosingStock}`)
              
              currentOpeningStock = subsequentClosingStock
            }
          }
          
          return row
        }
        return row
      })
      
      setProductRows(updatedRows)
      setStockUpdateTrigger(prev => prev + 1)
      console.log(`[DEBUG] Manual fix complete`)
    }
  }, [productRows])

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
        // Ensure customer has an ID if name is provided
        if (value.trim() && !row.customer.id) {
          row.customer.id = `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
        checkForDuplicates(row.product.name, value, rowIndex)
        const groupedRows = groupProductsByNameAndWarehouse(updatedRows, row.product.name, row.warehouse.name)
        setProductRows(groupedRows)
        return
      } else if (field === "warehouse.name") {
        row.warehouse.name = value.toUpperCase()
        // Ensure warehouse has an ID if name is provided
        if (value.trim() && !row.warehouse.id) {
          row.warehouse.id = `warehouse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
        const groupedRows = groupProductsByNameAndWarehouse(updatedRows, row.product.name, value)
        setProductRows(groupedRows)
        return
      } else if (field.startsWith("monthly_sales.")) {
        const monthKey = field.split(".")[1]
        const newSalesValue = Number.parseFloat(value) || 0
        console.log(`[v0] Sales changed for ${row.product.name} - ${row.customer.name} - ${row.warehouse.name}, month: ${monthKey}, new value: ${newSalesValue}`)
        row.monthly_sales[monthKey] = newSalesValue
        
        // When sales change, immediately recalculate closing stock for this month
        const currentOpeningStock = row.monthly_opening_stock[monthKey] || 0
        const currentShipments = row.monthly_shipments[monthKey] || []
        const currentTotalShipments = currentShipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
        const newClosingStock = currentOpeningStock + currentTotalShipments - newSalesValue
        
        console.log(`[v0] Immediate calculation for ${monthKey}: Opening=${currentOpeningStock}, Shipments=${currentTotalShipments}, Sales=${newSalesValue}, Closing=${newClosingStock}`)
        
        // Update closing stock for current month
        row.monthly_closing_stock[monthKey] = newClosingStock
        
        // Find month index to handle carry-forward
        const monthIndex = months.findIndex(m => m.key === monthKey)
        if (monthIndex >= 0 && monthIndex < months.length - 1) {
          const nextMonthKey = months[monthIndex + 1].key
          
          // Carry forward closing stock to next month's opening stock
          row.monthly_opening_stock[nextMonthKey] = newClosingStock
          
          // Update the opening stock input to show the calculated value
          // Only update if there's no existing manual input for the next month
          const inputKey = `${row.product.name}-${row.warehouse.name}-${nextMonthKey}`
          setOpeningStockInputs(prev => {
            const currentValue = prev[inputKey]
            console.log(`[DEBUG FIX] Sales change carry-forward to ${inputKey}: ${newClosingStock} (was: ${currentValue})`)
            return {
              ...prev,
              [inputKey]: newClosingStock.toString()
            }
          })
          
          console.log(`[v0] Carried forward ${newClosingStock} to ${nextMonthKey} opening stock`)
          
          // Now we need to recalculate all subsequent months to maintain the chain
          // This ensures that when sales change, the entire year's calculations are updated
          for (let i = monthIndex + 1; i < months.length; i++) {
            const subsequentMonthKey = months[i].key
            const subsequentOpeningStock = row.monthly_opening_stock[subsequentMonthKey] || 0
            const subsequentSales = row.monthly_sales[subsequentMonthKey] || 0
            const subsequentShipments = row.monthly_shipments[subsequentMonthKey] || []
            const subsequentTotalShipments = subsequentShipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
            const subsequentClosingStock = subsequentOpeningStock + subsequentTotalShipments - subsequentSales
            
            // Update closing stock for this month
            row.monthly_closing_stock[subsequentMonthKey] = subsequentClosingStock
            
            // Carry forward to next month (if not the last month)
            if (i < months.length - 1) {
              const nextSubsequentMonthKey = months[i + 1].key
              row.monthly_opening_stock[nextSubsequentMonthKey] = subsequentClosingStock
              
              // Update opening stock input
              // Only update if there's no existing manual input for the next month
              const subsequentInputKey = `${row.product.name}-${row.warehouse.name}-${nextSubsequentMonthKey}`
              setOpeningStockInputs(prev => {
                const currentValue = prev[subsequentInputKey]
                console.log(`[DEBUG FIX] Cascade carry-forward to ${subsequentInputKey}: ${subsequentClosingStock} (was: ${currentValue})`)
                return {
                  ...prev,
                  [subsequentInputKey]: subsequentClosingStock.toString()
                }
              })
              
              console.log(`[v0] Cascade calculation for ${subsequentMonthKey}: Opening=${subsequentOpeningStock}, Shipments=${subsequentTotalShipments}, Sales=${subsequentSales}, Closing=${subsequentClosingStock}`)
            }
          }
        }
      } else if (field.startsWith("monthly_opening_stock.")) {
        const monthKey = field.split(".")[1]
        row.monthly_opening_stock[monthKey] = Number.parseFloat(value) || 0
        
        // When opening stock changes, we need to recalculate all subsequent months
        // because the chain calculation depends on this value
        const monthIndex = months.findIndex(m => m.key === monthKey)
        if (monthIndex >= 0) {
          // Recalculate closing stock for current month
          const currentOpeningStock = Number.parseFloat(value) || 0
          const currentSales = row.monthly_sales[monthKey] || 0
          const currentShipments = row.monthly_shipments[monthKey] || []
          const currentTotalShipments = currentShipments.reduce((sum, shipment) => sum + (shipment.quantity || 0), 0)
          const newClosingStock = currentOpeningStock + currentTotalShipments - currentSales
          
          // Update closing stock for current month
          row.monthly_closing_stock[monthKey] = newClosingStock
          
          // Update opening stock inputs for the next month to show the calculated value
          if (monthIndex < months.length - 1) {
            const nextMonthKey = months[monthIndex + 1].key
            const inputKey = `${row.product.name}-${row.warehouse.name}-${nextMonthKey}`
            setOpeningStockInputs(prev => {
              const currentValue = prev[inputKey]
              console.log(`[DEBUG FIX] Opening stock change carry-forward to ${inputKey}: ${newClosingStock} (was: ${currentValue})`)
              return {
                ...prev,
                [inputKey]: newClosingStock.toString()
              }
            })
          }
        }
      } else if (field.startsWith("monthly_direct_shipment_text.")) {
        const monthKey = field.split(".")[1]
        if (!row.monthly_direct_shipment_text) {
          row.monthly_direct_shipment_text = {}
        }
        row.monthly_direct_shipment_text[monthKey] = value
      } else if (field.startsWith("monthly_direct_shipment_quantity.")) {
        const monthKey = field.split(".")[1]
        if (!row.monthly_direct_shipment_quantity) {
          row.monthly_direct_shipment_quantity = {}
        }
        const quantityValue = Number.parseFloat(value) || 0
        row.monthly_direct_shipment_quantity[monthKey] = quantityValue
        
        // For direct shipment rows, also update monthly_sales to keep them in sync
        if (row.rowType === "direct_shipment") {
          row.monthly_sales[monthKey] = quantityValue
        }
      }

      setProductRows(updatedRows)

      if (field.startsWith("monthly_sales.") || field.startsWith("monthly_opening_stock.") || field.startsWith("monthly_direct_shipment_quantity.")) {
        // For sales, opening stock, and direct shipment quantity changes, trigger recalculation
        setTimeout(() => {
          const stockUpdatedRows = calculateStockValues(updatedRows)
          const finalRows = calculateTotalSales(stockUpdatedRows)
          setProductRows(finalRows)
        }, 10)
      }
    },
    [productRows, saveToUndoStack, calculateStockValues, calculateTotalSales],
  )

  const getCurrentFieldValue = (rowIndex: number, field: string): string => {
    const row = productRows[rowIndex]
    if (!row) return ""

    if (field === "product.name") return row.product.name
    if (field === "customer.name") return row.customer.name
    if (field === "warehouse.name") return row.warehouse.name
    if (field === "annual_volume") return row.annual_volume.toString()
    if (field.startsWith("monthly_direct_shipment_text.")) {
      const monthKey = field.split(".")[1]
      return row.monthly_direct_shipment_text?.[monthKey] || ""
    }
    if (field.startsWith("monthly_direct_shipment_quantity.")) {
      const monthKey = field.split(".")[1]
      return (row.monthly_direct_shipment_quantity?.[monthKey] || 0).toString()
    }
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
      product: { id: newProductId, name: "", unit: "Kgs" },
      customer: { id: "", name: "" },
      warehouse: { id: "", name: "" },
      unit: "Kgs",
      annual_volume: 0,
      monthly_sales: {
        // Initialize all months with 0 to ensure the calculation function works properly
        ...months.reduce((acc, month) => ({ ...acc, [month.key]: 0 }), {})
      },
      monthly_shipments: {
        // Initialize all months with empty arrays
        ...months.reduce((acc, month) => ({ 
          ...acc, 
          [month.key]: []
        }), {})
      },
      monthly_opening_stock: {
        // Initialize all months with 0
        ...months.reduce((acc, month) => ({ 
          ...acc, 
          [month.key]: 0
        }), {})
      },
      monthly_closing_stock: {
        // Initialize all months with 0 to ensure the calculation function doesn't skip this row
        ...months.reduce((acc, month) => ({ ...acc, [month.key]: 0 }), {})
      },
      opening_stock: 0,
      closing_stock: 0,
      total_sales: 0,
      isEditing: false,
      isNew: true,
    }

    console.log("[v0] Adding new product, saving current state to undo stack")
    saveToUndoStack(productRows)
    const updatedRows = [...productRows, newRow]
    
    // Calculate stock values and total sales immediately with the new row data
    const stockUpdatedRows = calculateStockValues(updatedRows)
    const finalRows = calculateTotalSales(stockUpdatedRows)
    
    // Set the state with the recalculated rows
    setProductRows(finalRows)
    
    // Also update the opening stock inputs to show calculated values
    const initialInputs: { [key: string]: string } = {}
    finalRows.forEach(row => {
      months.forEach(({ key }) => {
        if (row.monthly_opening_stock[key] !== undefined) {
          const inputKey = `${row.product.name}-${row.warehouse.name}-${key}`
          initialInputs[inputKey] = row.monthly_opening_stock[key].toString()
        }
      })
    })
    setOpeningStockInputs(prev => {
      // Only update inputs that don't already have manual values
      const newInputs = { ...prev }
      Object.entries(initialInputs).forEach(([key, value]) => {
        const currentValue = newInputs[key]
        const isPlaceholderValue = !currentValue || currentValue === "" || currentValue === "0" || currentValue === "-1"
        
        // Only set if it's a placeholder value or if there's no existing meaningful manual input
        if (isPlaceholderValue || parseFloat(currentValue) <= 0) {
          newInputs[key] = value
        }
      })
      return newInputs
    })

    // Auto-focus on the new row
    setNewlyAddedRowIndex(productRows.length)
  }

  const handleAddDirectShipment = () => {
    const newProductId = `temp-direct-${Date.now()}`
    const firstMonthKey = months[0]?.key || "dec24"
    
    const newRow: ProductRow = {
      id: newProductId,
      product: { id: newProductId, name: "", unit: "Kgs" },
      customer: { id: "", name: "" },
      warehouse: { id: "", name: "" },
      unit: "Kgs",
      annual_volume: 0,
      monthly_sales: {
        // Initialize all months with 0
        ...months.reduce((acc, month) => ({ ...acc, [month.key]: 0 }), {})
      },
      monthly_shipments: {
        // Initialize all months with empty arrays
        ...months.reduce((acc, month) => ({ 
          ...acc, 
          [month.key]: []
        }), {})
      },
      monthly_opening_stock: {
        // Initialize all months with 0
        ...months.reduce((acc, month) => ({ 
          ...acc, 
          [month.key]: 0
        }), {})
      },
      monthly_closing_stock: {
        // Initialize all months with 0
        ...months.reduce((acc, month) => ({ ...acc, [month.key]: 0 }), {})
      },
      opening_stock: 0,
      closing_stock: 0,
      total_sales: 0,
      isEditing: false,
      isNew: true,
      rowType: "direct_shipment",
      monthly_direct_shipment_text: {
        // Initialize all months with empty strings
        ...months.reduce((acc, month) => ({ ...acc, [month.key]: "" }), {})
      },
      monthly_direct_shipment_quantity: {
        // Initialize all months with 0
        ...months.reduce((acc, month) => ({ ...acc, [month.key]: 0 }), {})
      },
    }

    console.log("[v0] Adding new direct shipment, saving current state to undo stack")
    saveToUndoStack(productRows)
    const updatedRows = [...productRows, newRow]
    
    // Calculate stock values and total sales immediately with the new row data
    const stockUpdatedRows = calculateStockValues(updatedRows)
    const finalRows = calculateTotalSales(stockUpdatedRows)
    
    // Set the state with the recalculated rows
    setProductRows(finalRows)
    
    // Also update the opening stock inputs to show calculated values
    const initialInputs: { [key: string]: string } = {}
    finalRows.forEach(row => {
      months.forEach(({ key }) => {
        if (row.monthly_opening_stock[key] !== undefined) {
          const inputKey = `${row.product.name}-${row.warehouse.name}-${key}`
          initialInputs[inputKey] = row.monthly_opening_stock[key].toString()
        }
      })
    })
    setOpeningStockInputs(prev => {
      // Only update inputs that don't already have manual values
      const newInputs = { ...prev }
      Object.entries(initialInputs).forEach(([key, value]) => {
        const currentValue = newInputs[key]
        const isPlaceholderValue = !currentValue || currentValue === "" || currentValue === "0" || currentValue === "-1"
        
        // Only set if it's a placeholder value or if there's no existing meaningful manual input
        if (isPlaceholderValue || parseFloat(currentValue) <= 0) {
          newInputs[key] = value
        }
      })
      return newInputs
    })

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
          // Initialize with empty shipments
        }, // Initialize with empty shipments
        monthly_opening_stock: {
          // Initialize with empty opening stock - users can set their own values
        }, // Initialize with empty opening stock
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
      
      // Calculate stock values and total sales immediately with the grouped rows
      const stockUpdatedRows = calculateStockValues(groupedRows)
      const finalRows = calculateTotalSales(stockUpdatedRows)
      setProductRows(finalRows)

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
      
      // Clean up opening stock inputs for deleted row
      const deletedRow = productRows[actualIndex]
      if (deletedRow) {
        const inputsToRemove: { [key: string]: string } = {}
        months.forEach(({ key }) => {
          const inputKey = `${deletedRow.product.name}-${deletedRow.warehouse.name}-${key}`
          inputsToRemove[inputKey] = ""
        })
        setOpeningStockInputs(prev => {
          const newInputs = { ...prev }
          Object.keys(inputsToRemove).forEach(key => delete newInputs[key])
          return newInputs
        })
      }
      
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

  // Filter system functions
  const getFilterOptions = () => {
    if (!filterType) return []

    let options: { id: string; name: string }[] = []
    
    if (filterType === "product") {
      options = [...new Set(productRows.map((row) => row?.product?.name).filter((name) => name?.trim()))]
        .map((name) => ({ id: name, name }))
    } else if (filterType === "customer") {
      options = [...new Set([
        ...productRows.map((row) => row?.customer?.name).filter((name) => name?.trim()),
        ...customers.map((c) => ({ id: c.id, name: c.name }))
      ])]
        .map((item) => typeof item === 'string' ? { id: item, name: item } : item)
    } else if (filterType === "warehouse") {
      options = [...new Set([
        ...productRows.map((row) => row?.warehouse?.name).filter((name) => name?.trim()),
        ...warehouses.map((w) => ({ id: w.id, name: w.name }))
      ])]
        .map((item) => typeof item === 'string' ? { id: item, name: item } : item)
    }

    return options.slice(0, 50) // Limit to 50 results for better UX
  }

  const applyFilter = (filterValueId: string) => {
    if (!filterType) return

    // Find the name from the ID
    let filterValueName = filterValueId
    if (filterType === "customer" || filterType === "warehouse") {
      const option = getFilterOptions().find(opt => opt.id === filterValueId)
      filterValueName = option?.name || filterValueId
    }

    // Apply the filter to the search query
    setSearchQuery(filterValueName)
    
    // Reset filter state
    setFilterType(null)
    setSelectedFilterValues(new Set())
  }

  const clearFilter = () => {
    // Force clear all filter states
    setFilterType(null)
    setSelectedFilterValues(new Set())
    setFilterSearchQuery("")
    setFilterDropdownOpen(false)
    setFilterValueDropdownOpen(false)
    
    // Always clear the main search query to reset table data
    setSearchQuery("")
    
    // Force a re-render by updating state
    setTimeout(() => {
      setFilterType(null)
      setSelectedFilterValues(new Set())
    }, 0)
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

  // Helper function to find row index by product, customer, and warehouse
  const findRowIndex = (productName: string, customerName: string, warehouseName: string) => {
    return filteredRows.findIndex(row => 
      row.product.name === productName && 
      row.customer.name === customerName && 
      row.warehouse.name === warehouseName
    )
  }

  const startShipmentEdit = (rowIndex: number, monthKey: string) => {
    console.log("[v0] ===== STARTING NEW SHIPMENT EDIT =====")
    console.log("[v0] Target rowIndex:", rowIndex, "monthKey:", monthKey)
    console.log("[v0] Current editingShipment state before clearing:", editingShipment)
    
    // Log the row we're trying to edit
    const targetRow = filteredRows[rowIndex]
    if (targetRow) {
      console.log("[v0] Target row:", {
        product: targetRow.product.name,
        customer: targetRow.customer.name,
        warehouse: targetRow.warehouse.name
      })
      console.log("[v0] Existing shipments for", monthKey, ":", targetRow.monthly_shipments?.[monthKey])
    } else {
      console.log("[v0] ERROR: No row found at index", rowIndex)
    }
    
    // Always clear any existing editing state first
    setEditingShipment(null)
    
    // Set new editing state with empty values for new shipment
    setTimeout(() => {
      console.log("[v0] Setting new editing state with EMPTY values")
      const newState = {
        rowIndex,
        monthKey,
        shipmentNumber: "",
        quantity: "",
      }
      console.log("[v0] New editing state:", newState)
      setEditingShipment(newState)
    }, 10) // Small delay to ensure state is cleared
  }

  const cancelShipmentEdit = () => {
    console.log("[v0] Canceling shipment edit, clearing state")
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
    
    // Recalculate stock values and total sales immediately with the updated data
    const stockUpdatedRows = calculateStockValues(updatedRows)
    const finalRows = calculateTotalSales(stockUpdatedRows)
    
    // Set the state with the recalculated rows
    setProductRows(finalRows)
    
    // Update opening stock inputs to reflect the recalculated carry-forward values
    // Only update subsequent months, not the current month where shipment was added
    const updatedInputs: { [key: string]: string } = {}
    finalRows.forEach(recalcRow => {
      months.forEach(({ key }, monthIndex) => {
        // Skip the first month (Dec 24) as it might have manually entered opening stock
        // Only update subsequent months that get carry-forward values
        if (monthIndex > 0) {
          const inputKey = `${recalcRow.product.name}-${recalcRow.warehouse.name}-${key}`
          if (recalcRow.monthly_opening_stock[key] !== undefined) {
            updatedInputs[inputKey] = recalcRow.monthly_opening_stock[key].toString()
          }
        }
      })
    })
    
    console.log(`[DEBUG FIX] Updating carry-forward opening stock inputs after shipment save:`, updatedInputs)
    setOpeningStockInputs(prev => ({
      ...prev,
      ...updatedInputs
    }))
    
    // IMPORTANT: Save to localStorage immediately to prevent data loss
    console.log('[ProductManagement] Saving shipment data to localStorage immediately')
    localStorage.setItem('inventoryProductData', JSON.stringify(finalRows))
    
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
      
      // Recalculate stock values and total sales immediately with the updated data
      const stockUpdatedRows = calculateStockValues(updatedRows)
      const finalRows = calculateTotalSales(stockUpdatedRows)
      
      // Set the state with the recalculated rows
      setProductRows(finalRows)
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
          bold: bold !== undefined ? bold : prev[shipmentQuantityKey]?.bold || false,
        },
      }))
    } else {
      // Regular field formatting
      setCellFormatting((prev) => ({
        ...prev,
        [cellKey]: {
          color,
          bold: bold !== undefined ? bold : prev[cellKey]?.bold || false,
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
        const productName = groupKey

        // Add opening stock row
        const openingStockRow: any = {
          "S.No": "",
          "Product Name": productName,
          "Customer Name": "OPENING STOCK",
          Warehouse: groupRows[0]?.warehouse?.name || "",
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
          Warehouse: groupRows[0]?.warehouse?.name || "",
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
          Warehouse: groupRows[0]?.warehouse?.name || "",
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
                {/* Filter Button */}
                <Popover open={filterDropdownOpen} onOpenChange={setFilterDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={filterType ? "outline" : "ghost"}
                      size="sm"
                      className={`relative hover:bg-slate-100 hover:text-slate-700 transition-all duration-200 rounded-lg px-2 py-2 ${
                        filterType ? "border-indigo-300 text-indigo-700 bg-indigo-50" : ""
                      }`}
                    >
                      <Filter className="h-4 w-4 text-slate-600" />
                      <span className="ml-2 text-sm font-medium">Filter</span>
                      {filterType && (
                        <span className="ml-2 text-xs bg-indigo-500 text-white px-2 py-1 rounded-full font-medium">
                          {filterType}
                        </span>
                      )}
                      {selectedFilterValues.size > 0 && (
                        <span className="ml-2 text-xs bg-emerald-500 text-white px-2 py-1 rounded-full font-medium">
                          {selectedFilterValues.size}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  
                  {/* Clear Filters Button */}
                  {selectedFilterValues.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilter}
                      className="ml-2 h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-all duration-200 rounded-lg border border-red-200"
                      title="Clear all filters"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <PopoverContent className="w-48 p-0" align="start">
                    <div className="bg-slate-900 text-white rounded-lg shadow-xl">
                      <div className="py-1">
                        <div
                          className="relative group"
                          onMouseEnter={() => {
                            if (!filterType) {
                              setFilterType("product")
                            }
                            setFilterValueDropdownOpen(true)
                          }}
                          onMouseLeave={() => {
                            setTimeout(() => setFilterValueDropdownOpen(false), 200)
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-left hover:bg-slate-800 rounded-none px-4 py-3 text-white hover:text-white"
                          >
                            <span>Product</span>
                            <span className="text-slate-400">&gt;</span>
                          </Button>
                          {/* Product Options Hover Popup */}
                          {filterType === "product" && (
                            <div className="absolute left-full top-0 ml-1 bg-slate-900 text-white rounded-lg shadow-xl min-w-[200px] z-50">
                              {/* Search Box */}
                              <div className="p-3 border-b border-slate-700">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                  <Input
                                    placeholder="Search products..."
                                    value={filterSearchQuery}
                                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                                    className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 text-sm placeholder:text-xs"
                                  />
                                </div>
                              </div>
                              <div className="py-1 max-h-64 overflow-y-auto">
                                {getFilterOptions()
                                  .filter(option => 
                                    option.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
                                  )
                                  .map((option) => (
                                  <Button
                                    key={option.id}
                                    variant="ghost"
                                    size="sm"
                                    className={`w-full justify-start text-left px-4 py-2 rounded-none hover:bg-slate-800 ${
                                      selectedFilterValues.has(option.name) 
                                        ? 'bg-blue-600 text-white' 
                                        : 'text-white'
                                    }`}
                                    onClick={() => {
                                      setSelectedFilterValues(prev => {
                                        const newSet = new Set(prev)
                                        if (newSet.has(option.name)) {
                                          newSet.delete(option.name)
                                        } else {
                                          newSet.add(option.name)
                                        }
                                        return newSet
                                      })
                                    }}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span>{option.name}</span>
                                      {selectedFilterValues.has(option.name) && (
                                        <span className="text-white text-sm">✓</span>
                                      )}
                                    </div>
                                  </Button>
                                ))}
                                {getFilterOptions().filter(option => 
                                  option.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
                                ).length === 0 && (
                                  <div className="text-slate-400 text-center py-4 text-sm">
                                    No products found
                                  </div>
                                )}
                              </div>
                              <div className="pt-2 border-t border-slate-700 space-y-1">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2"
                                  onClick={() => {
                                    if (selectedFilterValues.size > 0) {
                                      const filterValues = Array.from(selectedFilterValues)
                                      setSearchQuery(filterValues.join(" OR "))
                                      setFilterValueDropdownOpen(false)
                                      setFilterDropdownOpen(false)
                                    }
                                  }}
                                  disabled={selectedFilterValues.size === 0}
                                >
                                  Apply Filters ({selectedFilterValues.size})
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-slate-300 hover:text-white hover:bg-slate-800 text-sm py-2"
                                  onClick={clearFilter}
                                >
                                  Clear Filter
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div
                          className="relative group"
                          onMouseEnter={() => {
                            if (!filterType) {
                              setFilterType("customer")
                            }
                            setFilterValueDropdownOpen(true)
                          }}
                          onMouseLeave={() => {
                            setTimeout(() => setFilterValueDropdownOpen(false), 200)
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-left hover:bg-slate-800 rounded-none px-4 py-3 text-white hover:text-white"
                          >
                            <span>Customer</span>
                            <span className="text-slate-400">&gt;</span>
                          </Button>
                          {/* Customer Options Hover Popup */}
                          {filterType === "customer" && (
                            <div className="absolute left-full top-0 ml-1 bg-slate-900 text-white rounded-lg shadow-xl min-w-[200px] z-50">
                              {/* Search Box */}
                              <div className="p-3 border-b border-slate-700">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                  <Input
                                    placeholder="Search customers..."
                                    value={filterSearchQuery}
                                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                                    className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 text-sm placeholder:text-xs"
                                  />
                                </div>
                              </div>
                              <div className="py-1 max-h-64 overflow-y-auto">
                                {getFilterOptions()
                                  .filter(option => 
                                    option.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
                                  )
                                  .map((option) => (
                                  <Button
                                    key={option.id}
                                    variant="ghost"
                                    size="sm"
                                    className={`w-full justify-start text-left px-4 py-2 rounded-none hover:bg-slate-800 ${
                                      selectedFilterValues.has(option.name) 
                                        ? 'bg-blue-600 text-white' 
                                        : 'text-white'
                                    }`}
                                    onClick={() => {
                                      setSelectedFilterValues(prev => {
                                        const newSet = new Set(prev)
                                        if (newSet.has(option.name)) {
                                          newSet.delete(option.name)
                                        } else {
                                          newSet.add(option.name)
                                        }
                                        return newSet
                                      })
                                    }}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span>{option.name}</span>
                                      {selectedFilterValues.has(option.name) && (
                                        <span className="text-white text-sm">✓</span>
                                      )}
                                    </div>
                                  </Button>
                                ))}
                                {getFilterOptions().filter(option => 
                                  option.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
                                ).length === 0 && (
                                  <div className="text-slate-400 text-center py-4 text-sm">
                                    No customers found
                                  </div>
                                )}
                              </div>
                              <div className="pt-2 border-t border-slate-700 space-y-1">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2"
                                  onClick={() => {
                                    if (selectedFilterValues.size > 0) {
                                      const filterValues = Array.from(selectedFilterValues)
                                      setSearchQuery(filterValues.join(" OR "))
                                      setFilterValueDropdownOpen(false)
                                      setFilterDropdownOpen(false)
                                    }
                                  }}
                                  disabled={selectedFilterValues.size === 0}
                                >
                                  Apply Filters ({selectedFilterValues.size})
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-slate-300 hover:text-white hover:bg-slate-800 text-sm py-2"
                                  onClick={clearFilter}
                                >
                                  Clear Filter
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div
                          className="relative group"
                          onMouseEnter={() => {
                            if (!filterType) {
                              setFilterType("warehouse")
                            }
                            setFilterValueDropdownOpen(true)
                          }}
                          onMouseLeave={() => {
                            setTimeout(() => setFilterValueDropdownOpen(false), 200)
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-left hover:bg-slate-800 rounded-none px-4 py-3 text-white hover:text-white"
                          >
                            <span>Warehouse</span>
                            <span className="text-slate-400">&gt;</span>
                          </Button>
                          {/* Warehouse Options Hover Popup */}
                          {filterType === "warehouse" && (
                            <div className="absolute left-full top-0 ml-1 bg-slate-900 text-white rounded-lg shadow-xl min-w-[200px] z-50">
                              {/* Search Box */}
                              <div className="p-3 border-b border-slate-700">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-2 h-4 w-4 text-slate-400" />
                                  <Input
                                    placeholder="Search warehouses..."
                                    value={filterSearchQuery}
                                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                                    className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 text-sm placeholder:text-xs"
                                  />
                                </div>
                              </div>
                              <div className="py-1 max-h-64 overflow-y-auto">
                                {getFilterOptions()
                                  .filter(option => 
                                    option.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
                                  )
                                  .map((option) => (
                                  <Button
                                    key={option.id}
                                    variant="ghost"
                                    size="sm"
                                    className={`w-full justify-start text-left px-4 py-2 rounded-none hover:bg-slate-800 ${
                                      selectedFilterValues.has(option.name) 
                                        ? 'bg-blue-600 text-white' 
                                        : 'text-white'
                                    }`}
                                    onClick={() => {
                                      setSelectedFilterValues(prev => {
                                        const newSet = new Set(prev)
                                        if (newSet.has(option.name)) {
                                          newSet.delete(option.name)
                                        } else {
                                          newSet.add(option.name)
                                        }
                                        return newSet
                                      })
                                    }}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span>{option.name}</span>
                                      {selectedFilterValues.has(option.name) && (
                                        <span className="text-white text-sm">✓</span>
                                      )}
                                    </div>
                                  </Button>
                                ))}
                                {getFilterOptions().filter(option => 
                                  option.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
                                ).length === 0 && (
                                  <div className="text-slate-400 text-center py-4 text-sm">
                                    No warehouses found
                                  </div>
                                  )}
                              </div>
                              <div className="pt-2 border-t border-slate-700 space-y-1">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2"
                                  onClick={() => {
                                    if (selectedFilterValues.size > 0) {
                                      const filterValues = Array.from(selectedFilterValues)
                                      setSearchQuery(filterValues.join(" OR "))
                                      setFilterValueDropdownOpen(false)
                                      setFilterDropdownOpen(false)
                                    }
                                  }}
                                  disabled={selectedFilterValues.size === 0}
                                >
                                  Apply Filters ({selectedFilterValues.size})
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-slate-300 hover:text-white hover:bg-slate-800 text-sm py-2"
                                  onClick={clearFilter}
                                >
                                  Clear Filter
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                

                <div className="w-px h-6 bg-slate-200" />

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

                <div className="w-px h-6 bg-slate-200" />

                <AlertDialog open={showResetConfirmation} onOpenChange={setShowResetConfirmation}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-red-100 hover:text-red-700 transition-all duration-200 rounded-lg"
                      title="Reset all data and clear localStorage"
                    >
                      <RotateCcw className="h-4 w-4 text-red-600" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset All Data</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently clear all your data from localStorage and reset the component to its initial state. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={clearLocalStorageAndReset}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Reset Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>





              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-all duration-200 shadow-sm rounded-lg font-medium"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>




            </div>




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
              onClick={() => setTableZoomLevel(80)}
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

                      // Sort groups by product name, with regular warehouse groups first, then direct shipment groups
                      const sortedGroups = Object.entries(groups).sort(([keyA, groupRowsA], [keyB, groupRowsB]) => {
                        // Group keys are now "productName|warehouseName"
                        const [productNameA, warehouseNameA] = keyA.split('|')
                        const [productNameB, warehouseNameB] = keyB.split('|')
                        
                        // Empty product names (new entries) should appear at the bottom
                        if (productNameA === "" && productNameB !== "") return 1
                        if (productNameA !== "" && productNameB === "") return -1
                        
                        // First sort by product name alphabetically
                        const productComparison = productNameA.localeCompare(productNameB)
                        if (productComparison !== 0) {
                          return productComparison
                        }
                        
                        // For same product, sort by warehouse name alphabetically
                        const warehouseComparison = warehouseNameA.localeCompare(warehouseNameB)
                        if (warehouseComparison !== 0) {
                          return warehouseComparison
                        }
                        
                        return 0
                      })

                      sortedGroups.forEach(([groupKey, groupRows]) => {
                        // Group key is now "productName|warehouseName"
                        const [productName, warehouseName] = groupKey.split('|')
                        const { consolidatedOpeningStock, consolidatedClosingStock } =
                          calculateConsolidatedStock(groupRows)

                        // Sort rows within group: regular rows first, then direct shipment rows
                        const sortedGroupRows = groupRows.sort((a, b) => {
                          // Regular rows come first
                          if (a.rowType !== "direct_shipment" && b.rowType === "direct_shipment") return -1
                          if (a.rowType === "direct_shipment" && b.rowType !== "direct_shipment") return 1
                          // Within same type, maintain original order
                          return 0
                        })

                        // Add regular rows for this group
                        sortedGroupRows.forEach((row, groupIndex) => {
                          const originalIndex = filteredRows.findIndex(
                            (r) =>
                              r.product.id === row.product.id &&
                              r.customer.id === row.customer.id &&
                              r.warehouse.id === row.warehouse.id &&
                              r.rowType === row.rowType,
                          )

                          result.push(
                            <tr
                              key={`${row.product.id}-${row.customer.id}-${row.warehouse.id}-${row.rowType || 'regular'}`}
                              className={`${
                                row.rowType === "direct_shipment" 
                                  ? "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-400" 
                                  : "bg-white hover:bg-gray-50"
                              }`}
                            >
                              {/* ... existing table row content ... */}
                              <td className={`border border-gray-300 p-2 ${
                                row.rowType === "direct_shipment" ? "bg-yellow-50" : "bg-white"
                              }`}>
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
                              <td className={`border border-gray-300 p-2 ${
                                row.rowType === "direct_shipment" ? "bg-yellow-50" : "bg-white"
                              }`}>
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
                              <td className={`border border-gray-300 p-2 ${
                                row.rowType === "direct_shipment" ? "bg-yellow-50" : "bg-white"
                              }`}>
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
                              <td className={`border border-gray-300 p-2 ${
                                row.rowType === "direct_shipment" ? "bg-yellow-50" : "bg-white"
                              }`}>
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
                              <td className={`border border-gray-300 p-2 ${
                                row.rowType === "direct_shipment" ? "bg-yellow-50" : "bg-white"
                              }`}>
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
                                <td key={key} className={`border border-gray-300 p-1 min-w-[150px] text-center ${
                                  row.rowType === "direct_shipment" ? "bg-yellow-50" : "bg-white"
                                }`}>
                                  <div className="space-y-1">
                                    {row.rowType === "direct_shipment" ? (
                                      <>
                                        {/* Text input for direct shipment */}
                                        <Input
                                          type="text"
                                          value={row.monthly_direct_shipment_text?.[key] || ""}
                                          onChange={(e) =>
                                            updateCellValue(originalIndex, `monthly_direct_shipment_text.${key}`, e.target.value)
                                          }
                                          className="w-full h-8 text-center border border-gray-300 text-xs"
                                          onFocus={() =>
                                            setCurrentlyFocusedCell({
                                              rowIndex: originalIndex,
                                              field: `monthly_direct_shipment_text.${key}`,
                                            })
                                          }
                                          onBlur={() => stopCellEditing(originalIndex, `monthly_direct_shipment_text.${key}`)}
                                          onContextMenu={(e) => handleRightClick(e, originalIndex, `monthly_direct_shipment_text.${key}`)}
                                          data-row={originalIndex}
                                          data-field={`monthly_direct_shipment_text.${key}`}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              stopCellEditing(originalIndex, `monthly_direct_shipment_text.${key}`)
                                            } else if (e.key === "Tab") {
                                              e.preventDefault()
                                              handleTabNavigation(originalIndex, `monthly_direct_shipment_text.${key}`, e.shiftKey)
                                            }
                                          }}
                                        />
                                        {/* Sales input for direct shipment (quantity treated as sales) */}
                                        <Input
                                          type="number"
                                          placeholder="Sales"
                                          value={row.monthly_sales[key] || ""}
                                          onChange={(e) => {
                                            // Update both monthly_sales and monthly_direct_shipment_quantity
                                            updateCellValue(originalIndex, `monthly_sales.${key}`, e.target.value)
                                            updateCellValue(originalIndex, `monthly_direct_shipment_quantity.${key}`, e.target.value)
                                          }}
                                          className="w-full h-8 text-center border border-gray-300 text-xs placeholder:text-gray-400 placeholder:text-center"
                                          onFocus={() =>
                                            setCurrentlyFocusedCell({
                                              rowIndex: originalIndex,
                                              field: `monthly_sales.${key}`,
                                            })
                                          }
                                          onBlur={() => stopCellEditing(originalIndex, `monthly_sales.${key}`)}
                                          onContextMenu={(e) => handleRightClick(e, originalIndex, `monthly_sales.${key}`)}
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
                                      </>
                                    ) : (
                                      /* Regular sales input for non-direct shipment rows */
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
                                    )}
                                  </div>
                                </td>
                              ))}
                              <td className={`border border-gray-300 p-2 text-center ${
                                row.rowType === "direct_shipment" ? "bg-yellow-50" : "bg-white"
                              }`}>
                                {row.total_sales.toLocaleString()}
                              </td>
                              <td className={`border border-gray-300 p-2 text-center ${
                                row.rowType === "direct_shipment" ? "bg-yellow-50" : "bg-white"
                              }`}>
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

                        // Only show opening stock row if the group contains regular rows (non-direct shipment)
                        const hasRegularRows = sortedGroupRows.some(row => row.rowType !== "direct_shipment")
                        if (hasRegularRows) {
                          result.push(
                            // Opening Stock Row
                            <tr key={`${groupKey}-opening-stock`} className="bg-blue-50 border-t-2 border-blue-300">
                            <td className="border border-gray-300 p-2 font-semibold text-black text-center">Opening Stock</td>
                            <td className="border border-gray-300 p-2 text-black text-center">{productName}</td>
                            <td className="border border-gray-300 p-2 text-black text-center">{warehouseName}</td>
                            <td className="border border-gray-300 p-2 text-black text-center">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }, monthIndex) => {
                              // For opening stock, we want to show the consolidated value that properly carries forward
                              const specificRowOpeningStock = consolidatedOpeningStock[key] || 0
                              const manualInputValue = openingStockInputs[`${productName}-${warehouseName}-${key}`]
                              
                              // For the first month (Dec 24), prioritize manual input
                              // For subsequent months, prioritize consolidated value (carry-forward)
                              const displayValue = monthIndex === 0 
                                ? (manualInputValue || specificRowOpeningStock || "")
                                : (specificRowOpeningStock || manualInputValue || "")
                              
                              return (
                                <td key={key} className="border border-gray-300 p-1 text-center">
                                  <div className="space-y-1">
                                    <div className="flex flex-col items-center space-y-1">
                                      <Input
                                        type="number"
                                        value={displayValue}
                                        onChange={(e) =>
                                          updateGroupOpeningStock(
                                            productName,
                                            warehouseName,
                                            key,
                                            e.target.value,
                                          )
                                        }
                                        className={`w-full h-8 text-center border ${
                                          manualInputValue
                                            ? "border-blue-400 bg-blue-50"
                                            : "border-gray-300 bg-white"
                                        }`}
                                        placeholder="Auto-calculated"
                                      />
                                    </div>
                                  </div>
                                </td>
                              )
                            })}
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>,

                          <tr key={`${groupKey}-shipments`} className="bg-orange-50 border-t border-orange-300">
                            <td className="border border-gray-300 p-2 font-semibold text-black text-center">Shipments</td>
                            <td className="border border-gray-300 p-2 text-black text-center">{productName}</td>
                            <td className="border border-gray-300 p-2 text-black text-center">{warehouseName}</td>
                            <td className="border border-gray-300 p-2 text-black text-center">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }) => (
                              <td key={key} className="border border-gray-300 p-1 text-center">
                                <div className="space-y-1">
                                  {/* Display existing shipments */}
                                  {groupRows[0]?.monthly_shipments?.[key]?.map((shipment, shipmentIndex) => (
                                    <div key={shipmentIndex} className="flex items-center justify-center text-xs mt-1 space-x-2">
                                      <span
                                        className="cursor-pointer text-center"
                                        onContextMenu={(e) =>
                                          handleRightClick(
                                            e,
                                            findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || ""),
                                            "shipment",
                                            `${key}-${shipmentIndex}-number`,
                                          )
                                        }
                                        style={getCellStyle(
                                          findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || ""),
                                          "shipment",
                                          `${key}-${shipmentIndex}-number`,
                                        )}
                                      >
                                        {shipment.shipment_number}
                                      </span>
                                      <span
                                        className="cursor-pointer text-center"
                                        onContextMenu={(e) =>
                                          handleRightClick(
                                            e,
                                            findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || ""),
                                            "shipment",
                                            `${key}-${shipmentIndex}-quantity`,
                                          )
                                        }
                                        style={getCellStyle(
                                          findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || ""),
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
                                              findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || ""),
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
                                              findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || ""),
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
                                  {(() => {
                                    const shouldShow = editingShipment?.rowIndex === findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || "") && editingShipment?.monthKey === key
                                    if (shouldShow) {
                                      console.log("[v0] RENDERING EDITING INTERFACE for", key, "with state:", editingShipment)
                                    }
                                    return shouldShow
                                  })() && (
                                      <div className="space-y-1 mt-2 p-2 bg-white border border-orange-300 rounded"
                                           style={{ backgroundColor: '#fff3cd', border: '2px solid #ff6b35' }}>
                                        <Input
                                          key={`shipment-number-${editingShipment?.rowIndex}-${editingShipment?.monthKey}`}
                                          type="text"
                                          placeholder="Shipment #"
                                          value={editingShipment?.shipmentNumber || ""}
                                          onChange={(e) =>
                                            editingShipment && setEditingShipment({
                                              ...editingShipment,
                                              shipmentNumber: e.target.value,
                                            })
                                          }
                                          className="w-full h-6 text-xs bg-white border border-gray-300"
                                          autoFocus
                                        />
                                        <Input
                                          key={`shipment-quantity-${editingShipment?.rowIndex}-${editingShipment?.monthKey}`}
                                          type="number"
                                          placeholder="Quantity"
                                          value={editingShipment?.quantity || ""}
                                          onChange={(e) =>
                                            editingShipment && setEditingShipment({
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
                                    editingShipment.rowIndex !== findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || "") ||
                                    editingShipment.monthKey !== key) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        const targetRowIndex = findRowIndex(groupRows[0]?.product.name || "", groupRows[0]?.customer.name || "", groupRows[0]?.warehouse.name || "")
                                        console.log("[v0] +Shipment button clicked for:", {
                                          product: groupRows[0]?.product.name,
                                          customer: groupRows[0]?.customer.name,
                                          warehouse: groupRows[0]?.warehouse.name,
                                          month: key,
                                          calculatedRowIndex: targetRowIndex
                                        })
                                        startShipmentEdit(targetRowIndex, key)
                                      }}
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
                        }

                        // Only show closing stock row if the group contains regular rows (non-direct shipment)
                        if (hasRegularRows) {
                          result.push(
                            // Closing Stock Row
                            <tr key={`${groupKey}-closing-stock`} className="bg-green-50 border-b-4 border-red-500">
                            <td className="border border-gray-300 p-2 font-semibold text-black text-center">
                              Closing Stock
                            </td>
                            <td className="border border-gray-300 p-2 text-black text-center">{productName}</td>
                            <td className="border border-gray-300 p-2 text-black text-center">{warehouseName}</td>
                            <td className="border border-gray-300 p-2 text-black text-center">{groupRows[0]?.unit}</td>
                            <td className="border border-gray-300 p-2"></td>
                            {months.map(({ key }) => {
                              // For closing stock, use the consolidated closing stock value
                              const consolidatedClosingStockValue = consolidatedClosingStock[key] || 0
                              
                              // Also show the consolidated values for reference
                              const totalOpeningStock = consolidatedOpeningStock[key] || 0
                              const totalShipments = groupRows.reduce((sum, row) => {
                                if (!row || !row.monthly_shipments) return sum
                                const monthShipments = row.monthly_shipments[key] || []
                                return sum + monthShipments.reduce((shipmentSum, shipment) => shipmentSum + (shipment.quantity || 0), 0)
                              }, 0)
                              const totalSales = groupRows.reduce((sum, row) => {
                                if (!row || !row.monthly_sales) return sum
                                return sum + (row.monthly_sales[key] || 0)
                              }, 0)
                              const totalClosingStock = consolidatedClosingStock[key] || 0
                              

                              
                              return (
                                <td key={key} className="border border-gray-300 p-1 text-center">
                                  <div className="w-full h-8 text-center border border-gray-300 bg-gray-100 flex items-center justify-center font-medium">
                                    {consolidatedClosingStockValue?.toLocaleString() || "0"}
                                  </div>

                                </td>
                              )
                            })}
                            <td className="border border-gray-300 p-2"></td>
                            <td className="border border-gray-300 p-2"></td>
                          </tr>,
                          )
                        }
                      })

                      return result
                    })()
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={months.length + 6} className="border border-gray-300 p-4 text-center bg-gradient-to-r from-slate-50 to-gray-50">
                      <div className="flex gap-4 justify-center">
                        <Button
                          size="sm"
                          onClick={handleAddProduct}
                          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3 rounded-xl font-semibold"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Product
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddDirectShipment}
                          className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3 rounded-xl font-semibold"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Direct Shipment
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tfoot>
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
            onClick={() => applyFormatting("red", true)}
          >
            🔴 Red
          </button>
          <button
            className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full text-left transition-colors duration-200 rounded-lg mx-1 my-1 font-medium"
            onClick={() => applyFormatting("green", true)}
          >
            🟢 Green
          </button>
          <button
            className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 w-full text-left transition-colors duration-200 rounded-lg mx-1 my-1 font-medium"
            onClick={() => applyFormatting("black", true)}
          >
            ⚫ Black
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

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}
