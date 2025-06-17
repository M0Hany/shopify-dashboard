import { useState, useEffect, useMemo } from 'react';
import {
  getPackagesList,
  getPackageStatus,
  getAWB,
  type GetPackagesListResponse,
  type GetPackagesListPayload,
  type ShippingPackage
} from '../services/shipping';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  TextField, 
  MenuItem, 
  Box, 
  CircularProgress, 
  Alert,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks, startOfDay, endOfDay, subDays } from 'date-fns';

type DateRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRange {
  start: string;
  end: string;
}

const Shipping = () => {
  const [packages, setPackages] = useState<ShippingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState(1);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [dateRangeType, setDateRangeType] = useState<DateRangePreset>('thisMonth');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const getDateRangeFromPreset = (preset: DateRangePreset): DateRange => {
    const today = new Date();
    
    switch (preset) {
      case 'today':
        return {
          start: format(startOfDay(today), 'yyyy-MM-dd'),
          end: format(endOfDay(today), 'yyyy-MM-dd')
        };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return {
          start: format(startOfDay(yesterday), 'yyyy-MM-dd'),
          end: format(endOfDay(yesterday), 'yyyy-MM-dd')
        };
      case 'thisWeek':
        return {
          start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'lastWeek':
        const lastWeek = subWeeks(today, 1);
        return {
          start: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'thisMonth':
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd')
        };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return {
          start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          end: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
        };
      case 'custom':
        return customDateRange;
      default:
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd')
        };
    }
  };

  const currentDateRange = useMemo(() => getDateRangeFromPreset(dateRangeType), [dateRangeType, dateRangeType === 'custom' ? customDateRange : null]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const payload: GetPackagesListPayload = {
        FilterModel: {
          PageFilter: {
            PageIndex: pageIndex + 1,
            PageSize: pageSize
          },
          SearchKeyword: ""
        },
        From: currentDateRange.start,
        To: currentDateRange.end,
        SelectedTab: selectedTab,
        MerchantIds: [16677],
        WarehouseIds: [],
        SubscriberIds: [],
        HubId: [],
        HubTypeId: 0,
        PhaseId: [],
        MylerIds: [],
        TransferBy: [],
        ServiceTypeId: [],
        ServiceCategoryId: [],
        PaymentTypeId: [],
        StatusId: [],
        PackageServiceId: [],
        AttemptsNumber: null,
        MemberId: 22376,
        Barcodes: [],
        PreferedTimeSlot: 0,
        AvailableTimeslotId: 0,
        DateTypeId: 3,
        SearchOptionId: 1,
        MemberCategoryID: 2
      };

      const response = await getPackagesList(payload);
      setPackages(response.Value.Result);
      setTotalCount(response.Value.Total);
    } catch (error) {
      console.error('Error fetching packages:', error);
      setError('Failed to fetch packages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [selectedTab, pageIndex, dateRangeType, dateRangeType === 'custom' ? customDateRange : null]);

  const handleDownloadAWB = async (barcode: string, referenceNumber: string | null) => {
    try {
      if (!referenceNumber) {
        throw new Error('Reference number is required to download AWB');
      }
      const awbBlob = await getAWB(barcode, referenceNumber);
      const url = window.URL.createObjectURL(awbBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `awb-${barcode}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading AWB:', error);
      setError('Failed to download AWB. Please try again.');
    }
  };

  const handleRefresh = () => {
    fetchPackages();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Shipping Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={selectedTab}
            label="Status"
            onChange={(e) => setSelectedTab(Number(e.target.value))}
          >
            <MenuItem value={1}>Needs Your Attention</MenuItem>
            <MenuItem value={2}>In Progress</MenuItem>
            <MenuItem value={3}>Completed</MenuItem>
            <MenuItem value={6}>Uploaded</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Date Range</InputLabel>
          <Select
            value={dateRangeType}
            label="Date Range"
            onChange={(e) => setDateRangeType(e.target.value as DateRangePreset)}
          >
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="yesterday">Yesterday</MenuItem>
            <MenuItem value="thisWeek">This Week</MenuItem>
            <MenuItem value="lastWeek">Last Week</MenuItem>
            <MenuItem value="thisMonth">This Month</MenuItem>
            <MenuItem value="lastMonth">Last Month</MenuItem>
            <MenuItem value="custom">Custom Range</MenuItem>
          </Select>
        </FormControl>

        {dateRangeType === 'custom' && (
          <>
            <TextField
              type="date"
              label="Start Date"
              value={customDateRange.start}
              onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
            <TextField
              type="date"
              label="End Date"
              value={customDateRange.end}
              onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
          </>
        )}

        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {packages.map((pkg) => (
            <Card key={pkg.PackageId}>
              <CardContent>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ flex: '1 1 300px' }}>
                    <Typography variant="subtitle1">
                      <strong>Customer:</strong> {pkg.CustomerName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Phone:</strong> {pkg.PhoneNo}
                    </Typography>
                    <Typography variant="body2">
                      <strong>City:</strong> {pkg.CityEnName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Zone:</strong> {pkg.ZoneEnName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Sub Zone:</strong> {pkg.SubZoneEnName}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: '1 1 300px' }}>
                    <Typography variant="body2">
                      <strong>Barcode:</strong> {pkg.Barcode}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Status:</strong> {pkg.PackageENStatus}
                    </Typography>
                    <Typography variant="body2">
                      <strong>COD Value:</strong> {pkg.CODValue}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Reference:</strong> {pkg.RefrenceNumber || 'N/A'}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadAWB(pkg.Barcode, pkg.RefrenceNumber)}
                        disabled={!pkg.RefrenceNumber}
                      >
                        Download AWB
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {!loading && packages.length === 0 && (
        <Typography variant="body1" sx={{ textAlign: 'center', mt: 3 }}>
          No packages found
        </Typography>
      )}
    </Box>
  );
};

export default Shipping; 