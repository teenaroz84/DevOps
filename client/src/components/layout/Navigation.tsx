import React, { useState } from 'react'
import {
  Box,
  Drawer,
  Typography,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Switch,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import TuneIcon from '@mui/icons-material/Tune'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DataObjectIcon from '@mui/icons-material/DataObject'
import { useMockData } from '../../context/MockDataContext'

interface NavigationProps {
  activeMenu: 'dashboard' | 'chat' | 'preferences' | 'executive' | 'quicksight-demo'
  onMenuChange: (menu: 'dashboard' | 'chat' | 'preferences' | 'executive' | 'quicksight-demo') => void
}

export const Navigation: React.FC<NavigationProps> = ({ activeMenu, onMenuChange }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const drawerWidth = isExpanded ? 260 : 80
  const { useMock, toggleMock } = useMockData()

  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#f5f5f5',
          borderRight: '1px solid #e0e0e0',
          transition: 'width 0.3s ease',
        },
      }}
      variant="permanent"
      anchor="left"
    >
      {/* Logo and Toggle Section */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        {isExpanded && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: '#1976d2',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: '14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            📊 DataOps
          </Typography>
        )}
        <IconButton
          onClick={() => setIsExpanded(!isExpanded)}
          size="small"
          sx={{
            marginLeft: 'auto',
            color: '#1976d2',
            flexShrink: 0,
          }}
        >
          {isExpanded ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      {/* Menu Items */}
      <Box sx={{ flex: 1, px: 1, py: 2 }}>
        {/* Executive Dashboard - First Item */}
        <Tooltip title={!isExpanded ? 'Executive Dashboard' : ''} placement="right">
          <Box
            component="button"
            onClick={() => onMenuChange('executive')}
            sx={{
              width: isExpanded ? 'calc(100% - 24px)' : 'calc(100% - 24px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              gap: isExpanded ? 2 : 0,
              padding: '12px 16px',
              margin: '8px 12px',
              borderRadius: 1,
              border: 'none',
              backgroundColor: activeMenu === 'executive' ? '#e3f2fd' : 'transparent',
              color: activeMenu === 'executive' ? '#1976d2' : '#666',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#f5f5f5',
                color: '#1976d2',
              },
            }}
          >
          <AnalyticsIcon sx={{ fontSize: '20px', flexShrink: 0 }} />
          {isExpanded && (
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: activeMenu === 'executive' ? 600 : 500,
                color: 'inherit',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Executive Dashboard
            </Typography>
          )}
          </Box>
        </Tooltip>

        {/* Dashboard - hidden */}
        <Tooltip title={!isExpanded ? 'Sample Dashboard' : ''} placement="right">
          <Box
            component="button"
            onClick={() => onMenuChange('dashboard')}
            sx={{
            display: 'none',
            alignItems: 'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap: isExpanded ? 2 : 0,
            padding: '12px 16px',
            margin: '8px 12px',
            borderRadius: 1,
            border: 'none',
            backgroundColor: activeMenu === 'dashboard' ? '#e3f2fd' : 'transparent',
            color: activeMenu === 'dashboard' ? '#1976d2' : '#666',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#f5f5f5',
              color: '#1976d2',
            },
          }}
        >
          <DashboardIcon sx={{ fontSize: '20px', flexShrink: 0 }} />
          {isExpanded && (
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: activeMenu === 'dashboard' ? 600 : 500,
                color: 'inherit',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Sample Dashboard
            </Typography>
          )}
          </Box>
        </Tooltip>

        {/* DataOps Assistant */}
        <Tooltip title={!isExpanded ? 'Assistant' : ''} placement="right">
          <Box
            component="button"
            onClick={() => onMenuChange('chat')}
            sx={{
            width: isExpanded ? 'calc(100% - 24px)' : 'calc(100% - 24px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap: isExpanded ? 2 : 0,
            padding: '12px 16px',
            margin: '8px 12px',
            borderRadius: 1,
            border: 'none',
            backgroundColor: activeMenu === 'chat' ? '#e3f2fd' : 'transparent',
            color: activeMenu === 'chat' ? '#1976d2' : '#666',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#f5f5f5',
              color: '#1976d2',
            },
          }}
        >
          <SmartToyIcon sx={{ fontSize: '20px', flexShrink: 0 }} />
          {isExpanded && (
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: activeMenu === 'chat' ? 600 : 500,
                color: 'inherit',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Assistant
            </Typography>
          )}
          </Box>
        </Tooltip>

        {/* QuickSight Demo - hidden */}
        <Tooltip title={!isExpanded ? 'QuickSight' : ''} placement="right">
          <Box
            component="button"
            onClick={() => onMenuChange('quicksight-demo')}
            sx={{
            display: 'none',
            alignItems: 'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap: isExpanded ? 2 : 0,
            padding: '12px 16px',
            margin: '8px 12px',
            borderRadius: 1,
            border: 'none',
            backgroundColor: activeMenu === 'quicksight-demo' ? '#e3f2fd' : 'transparent',
            color: activeMenu === 'quicksight-demo' ? '#1976d2' : '#666',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#f5f5f5',
              color: '#1976d2',
            },
          }}
        >
          <AnalyticsIcon sx={{ fontSize: '20px', flexShrink: 0 }} />
          {isExpanded && (
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: activeMenu === 'quicksight-demo' ? 600 : 500,
                color: 'inherit',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              QuickSight
            </Typography>
          )}
          </Box>
        </Tooltip>

        {/* User Preferences - hidden */}
        <Tooltip title={!isExpanded ? 'Preferences' : ''} placement="right">
          <Box
            component="button"
            onClick={() => onMenuChange('preferences')}
            sx={{
            display: 'none',
            alignItems: 'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap: isExpanded ? 2 : 0,
            padding: '12px 16px',
            margin: '8px 12px',
            borderRadius: 1,
            border: 'none',
            backgroundColor: activeMenu === 'preferences' ? '#e3f2fd' : 'transparent',
            color: activeMenu === 'preferences' ? '#1976d2' : '#666',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: '#f5f5f5',
              color: '#1976d2',
            },
          }}
        >
          <TuneIcon sx={{ fontSize: '20px', flexShrink: 0 }} />
          {isExpanded && (
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: activeMenu === 'preferences' ? 600 : 500,
                color: 'inherit',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Preferences
            </Typography>
          )}
          </Box>
        </Tooltip>
      </Box>

      {/* Mock Data Toggle */}
      <Divider sx={{ my: 1 }} />
      <Tooltip title={useMock ? 'Switch to Live API data' : 'Switch to Mock data'} placement="right">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'space-between' : 'center',
            px: isExpanded ? 2 : 0,
            py: 0.75,
            cursor: 'pointer',
            '&:hover': { bgcolor: '#f0f4ff' },
          }}
          onClick={toggleMock}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DataObjectIcon sx={{ fontSize: 18, color: useMock ? '#f57c00' : '#9e9e9e' }} />
            {isExpanded && (
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: useMock ? '#f57c00' : '#777' }}>
                {useMock ? 'Mock Data' : 'Live Data'}
              </Typography>
            )}
          </Box>
          {isExpanded && (
            <Switch
              checked={useMock}
              onChange={toggleMock}
              onClick={e => e.stopPropagation()}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#f57c00' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#f57c00' },
              }}
            />
          )}
        </Box>
      </Tooltip>

      {/* Status */}
      {isExpanded && (
        <>
          <Divider sx={{ my: 1 }} />
        </>
      )}
    </Drawer>
  )
}
