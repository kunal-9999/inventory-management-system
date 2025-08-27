"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Edit, Calculator, TrendingUp, TrendingDown, Package, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

interface Product {
  id: string
  name: string
  unit: string
}

interface Warehouse {
  id: string
  name: string
}

interface StockRecord {
  id: string
  product_id: string
  warehouse_id: string
  month: number
  year: number
  opening_stock: number
  closing_stock: number
  unit: string
  created_at: string
  product: Product
  warehouse: Warehouse
}

interface StockCalculation {
  opening_stock: number
  total_shipments: number
  total_sales: number
  calculated_closing_stock: number
  actual_closing_stock: number
  variance: number
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function StockManagement() {
  const [stockRecords, setStockRecords] = useState<StockRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedStock, setSelectedStock] = useState<StockRecord | null>(null)
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false)
  const [stockCalculations, setStockCalculations] = useState<Record<string, StockCalculation>>({})
  const [loading, setLoading] = useState(true)

  // Filter states
  const [filters, setFilters] = useState({
    month: "",
    year: new Date().getFullYear().toString(),
    product_id: "",
    warehouse_id: "",
  })

  // Form states
  const [stockForm, setStockForm] = useState({
    product_id: "",
    warehouse_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    opening_stock: "",
    closing_stock: "",
    unit: "Kgs",
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchFilteredStock()
  }, [filters])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, unit")
        .order("name")

      if (productsError) throw productsError
      setProducts(productsData || [])

      // Fetch warehouses
      const { data: warehousesData, error: warehousesError } = await supabase
        .from("warehouses")
        .select("id, name")
        .order("name")

      if (warehousesError) throw warehousesError
      setWarehouses(warehousesData || [])

      // Initial stock fetch
      await fetchFilteredStock()
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFilteredStock = async () => {
    try {
      let query = supabase
        .from("stock_records")
        .select(`
          *,
          product:products(id, name, unit),
          warehouse:warehouses(id, name)
        `)
        .order("created_at", { ascending: false })

      // Apply filters
      if (filters.year) {
        query = query.eq("year", Number.parseInt(filters.year))
      }
      if (filters.month) {
        query = query.eq("month", Number.parseInt(filters.month))
      }
      if (filters.product_id) {
        query = query.eq("product_id", filters.product_id)
      }
      if (filters.warehouse_id) {
        query = query.eq("warehouse_id", filters.warehouse_id)
      }

      const { data, error } = await query

      if (error) throw error
      setStockRecords(data || [])

      // Calculate stock calculations for each record
      await calculateStockMetrics(data || [])
    } catch (error) {
      console.error("Error fetching stock records:", error)
    }
  }

  const calculateStockMetrics = async (records: StockRecord[]) => {
    const calculations: Record<string, StockCalculation> = {}

    for (const record of records) {
      try {
        // Get shipments for this product/warehouse/month/year
        const { data: shipments, error: shipmentsError } = await supabase
          .from("shipments")
          .select("quantity")
          .eq("product_id", record.product_id)
          .eq("warehouse_id", record.warehouse_id)
          .eq("month", record.month)
          .eq("year", record.year)

        if (shipmentsError) throw shipmentsError

        // Get sales for this product/warehouse/month/year
        const { data: sales, error: salesError } = await supabase
          .from("sales")
          .select("quantity")
          .eq("product_id", record.product_id)
          .eq("warehouse_id", record.warehouse_id)
          .eq("month", record.month)
          .eq("year", record.year)

        if (salesError) throw salesError

        const totalShipments = shipments?.reduce((sum, s) => sum + s.quantity, 0) || 0
        const totalSales = sales?.reduce((sum, s) => sum + s.quantity, 0) || 0
        const calculatedClosingStock = record.opening_stock + totalShipments - totalSales
        const variance = record.closing_stock - calculatedClosingStock

        calculations[record.id] = {
          opening_stock: record.opening_stock,
          total_shipments: totalShipments,
          total_sales: totalSales,
          calculated_closing_stock: calculatedClosingStock,
          actual_closing_stock: record.closing_stock,
          variance: variance,
        }
      } catch (error) {
        console.error("Error calculating metrics for record:", record.id, error)
      }
    }

    setStockCalculations(calculations)
  }

  const handleCreateStock = async () => {
    try {
      const { data, error } = await supabase
        .from("stock_records")
        .insert([
          {
            ...stockForm,
            opening_stock: Number.parseFloat(stockForm.opening_stock),
            closing_stock: Number.parseFloat(stockForm.closing_stock),
          },
        ])
        .select(`
          *,
          product:products(id, name, unit),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      setStockRecords([data[0], ...stockRecords])
      setStockForm({
        product_id: "",
        warehouse_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        opening_stock: "",
        closing_stock: "",
        unit: "Kgs",
      })
      setIsStockDialogOpen(false)

      // Recalculate metrics
      await calculateStockMetrics([data[0], ...stockRecords])
    } catch (error) {
      console.error("Error creating stock record:", error)
    }
  }

  const handleUpdateStock = async () => {
    if (!selectedStock) return

    try {
      const { data, error } = await supabase
        .from("stock_records")
        .update({
          ...stockForm,
          opening_stock: Number.parseFloat(stockForm.opening_stock),
          closing_stock: Number.parseFloat(stockForm.closing_stock),
        })
        .eq("id", selectedStock.id)
        .select(`
          *,
          product:products(id, name, unit),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      const updatedRecords = stockRecords.map((s) => (s.id === selectedStock.id ? data[0] : s))
      setStockRecords(updatedRecords)
      setStockForm({
        product_id: "",
        warehouse_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        opening_stock: "",
        closing_stock: "",
        unit: "Kgs",
      })
      setSelectedStock(null)
      setIsStockDialogOpen(false)

      // Recalculate metrics
      await calculateStockMetrics(updatedRecords)
    } catch (error) {
      console.error("Error updating stock record:", error)
    }
  }

  const handleAutoCalculateClosing = async () => {
    if (!stockForm.product_id || !stockForm.warehouse_id) return

    try {
      // Get shipments for this product/warehouse/month/year
      const { data: shipments, error: shipmentsError } = await supabase
        .from("shipments")
        .select("quantity")
        .eq("product_id", stockForm.product_id)
        .eq("warehouse_id", stockForm.warehouse_id)
        .eq("month", stockForm.month)
        .eq("year", stockForm.year)

      if (shipmentsError) throw shipmentsError

      // Get sales for this product/warehouse/month/year
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("quantity")
        .eq("product_id", stockForm.product_id)
        .eq("warehouse_id", stockForm.warehouse_id)
        .eq("month", stockForm.month)
        .eq("year", stockForm.year)

      if (salesError) throw salesError

      const totalShipments = shipments?.reduce((sum, s) => sum + s.quantity, 0) || 0
      const totalSales = sales?.reduce((sum, s) => sum + s.quantity, 0) || 0
      const openingStock = Number.parseFloat(stockForm.opening_stock) || 0
      const calculatedClosing = openingStock + totalShipments - totalSales

      setStockForm({
        ...stockForm,
        closing_stock: calculatedClosing.toString(),
      })
    } catch (error) {
      console.error("Error calculating closing stock:", error)
    }
  }

  const openEditDialog = (stock: StockRecord) => {
    setSelectedStock(stock)
    setStockForm({
      product_id: stock.product_id,
      warehouse_id: stock.warehouse_id,
      month: stock.month,
      year: stock.year,
      opening_stock: stock.opening_stock.toString(),
      closing_stock: stock.closing_stock.toString(),
      unit: stock.unit,
    })
    setIsStockDialogOpen(true)
  }

  const openNewStockDialog = () => {
    setSelectedStock(null)
    setStockForm({
      product_id: "",
      warehouse_id: "",
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      opening_stock: "",
      closing_stock: "",
      unit: "Kgs",
    })
    setIsStockDialogOpen(true)
  }

  const clearFilters = () => {
    setFilters({
      month: "",
      year: new Date().getFullYear().toString(),
      product_id: "",
      warehouse_id: "",
    })
  }

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-green-600"
    if (variance < 0) return "text-red-600"
    return "text-muted"
  }

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Package className="h-4 w-4 text-muted" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted">Loading stock data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Stock Management</h2>
          <p className="text-muted mt-1">Track opening and closing stock with automatic calculations</p>
        </div>
        <Button onClick={openNewStockDialog} className="bg-secondary hover:bg-secondary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Stock Record
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Closing stock is calculated as: Opening Stock + Shipments - Sales. Variance shows the difference between
          calculated and actual closing stock.
        </AlertDescription>
      </Alert>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter stock records by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={filters.year} onValueChange={(value) => setFilters({ ...filters, year: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={filters.month} onValueChange={(value) => setFilters({ ...filters, month: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All months</SelectItem>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={filters.product_id}
                onValueChange={(value) => setFilters({ ...filters, product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select
                value={filters.warehouse_id}
                onValueChange={(value) => setFilters({ ...filters, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={clearFilters} className="w-full bg-transparent">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Records</CardTitle>
          <CardDescription>View and manage stock records with automatic calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Opening Stock</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Calculated Closing</TableHead>
                <TableHead>Actual Closing</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockRecords.map((record) => {
                const calc = stockCalculations[record.id]
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      {MONTHS[record.month - 1]} {record.year}
                    </TableCell>
                    <TableCell className="font-medium">{record.product.name}</TableCell>
                    <TableCell>{record.warehouse.name}</TableCell>
                    <TableCell className="font-mono">{record.opening_stock.toLocaleString()}</TableCell>
                    <TableCell className="font-mono">{calc ? calc.total_shipments.toLocaleString() : "-"}</TableCell>
                    <TableCell className="font-mono">{calc ? calc.total_sales.toLocaleString() : "-"}</TableCell>
                    <TableCell className="font-mono">
                      {calc ? calc.calculated_closing_stock.toLocaleString() : "-"}
                    </TableCell>
                    <TableCell className="font-mono">{record.closing_stock.toLocaleString()}</TableCell>
                    <TableCell>
                      <div
                        className={`flex items-center gap-1 font-mono ${calc ? getVarianceColor(calc.variance) : ""}`}
                      >
                        {calc && getVarianceIcon(calc.variance)}
                        {calc ? calc.variance.toLocaleString() : "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.unit}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(record)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stock Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedStock ? "Edit Stock Record" : "Add Stock Record"}</DialogTitle>
            <DialogDescription>
              {selectedStock ? "Update stock information" : "Add a new stock record"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={stockForm.product_id}
                onValueChange={(value) => {
                  const product = products.find((p) => p.id === value)
                  setStockForm({
                    ...stockForm,
                    product_id: value,
                    unit: product?.unit || "Kgs",
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select product</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select
                value={stockForm.warehouse_id}
                onValueChange={(value) => setStockForm({ ...stockForm, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select warehouse</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="month">Month</Label>
                <Select
                  value={stockForm.month.toString()}
                  onValueChange={(value) => setStockForm({ ...stockForm, month: Number.parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Select month</SelectItem>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={month} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={stockForm.year}
                  onChange={(e) => setStockForm({ ...stockForm, year: Number.parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="opening_stock">Opening Stock ({stockForm.unit})</Label>
              <Input
                id="opening_stock"
                type="number"
                step="0.01"
                value={stockForm.opening_stock}
                onChange={(e) => setStockForm({ ...stockForm, opening_stock: e.target.value })}
                placeholder="Enter opening stock"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="closing_stock">Closing Stock ({stockForm.unit})</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoCalculateClosing}
                  disabled={!stockForm.product_id || !stockForm.warehouse_id || !stockForm.opening_stock}
                >
                  <Calculator className="h-4 w-4 mr-1" />
                  Auto Calculate
                </Button>
              </div>
              <Input
                id="closing_stock"
                type="number"
                step="0.01"
                value={stockForm.closing_stock}
                onChange={(e) => setStockForm({ ...stockForm, closing_stock: e.target.value })}
                placeholder="Enter closing stock"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit">Unit</Label>
              <Select value={stockForm.unit} onValueChange={(value) => setStockForm({ ...stockForm, unit: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kgs">Kgs</SelectItem>
                  <SelectItem value="Lbs">Lbs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={selectedStock ? handleUpdateStock : handleCreateStock}
              className="bg-secondary hover:bg-secondary/90"
            >
              {selectedStock ? "Update" : "Add"} Stock Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
