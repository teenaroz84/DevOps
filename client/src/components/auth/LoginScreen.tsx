import React, { useState } from 'react'
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import LoginIcon from '@mui/icons-material/Login'
import type { AuthSession } from '../../services/auth'
import { authService } from '../../services/auth'
import { TRUIST } from '../../theme/truistPalette'

interface LoginScreenProps {
  onLogin: (session: AuthSession) => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = authService.login(userId, password)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setError('')
    onLogin(result.session)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        background: `radial-gradient(circle at top left, ${TRUIST.mist} 0%, ${TRUIST.shell} 42%, ${TRUIST.paper} 100%)`,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 960,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          overflow: 'hidden',
          borderRadius: 4,
          border: `1px solid ${TRUIST.line}`,
          boxShadow: '0 24px 80px rgba(46,26,71,0.10)',
        }}
      >
        <Box
          sx={{
            p: { xs: 4, md: 5 },
            color: TRUIST.white,
            background: `linear-gradient(160deg, ${TRUIST.purple} 0%, ${TRUIST.charcoal} 100%)`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 5,
          }}
        >
          <Stack spacing={2.5}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <ShieldOutlinedIcon sx={{ fontSize: 30 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: { xs: '32px', md: '40px' }, fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
                DataOps Agent Access
              </Typography>
             {/*  <Typography sx={{ mt: 1.5, maxWidth: 420, color: 'rgba(255,255,255,0.76)', fontSize: '15px', lineHeight: 1.7 }}>
                Sign in with your assigned user to keep full-screen agent sessions tied to your user ID and persistent browser session.
              </Typography> */}
            </Box>
          </Stack>

          {/* <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            {['admin / admin', 'developer / developer'].map((credential) => (
              <Box
                key={credential}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <Typography sx={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)' }}>
                  Allowed Login
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: '15px', fontWeight: 600 }}>{credential}</Typography>
              </Box>
            ))}
          </Box>*/}
        </Box> 

        <Box sx={{ p: { xs: 4, md: 5 }, backgroundColor: TRUIST.white, display: 'flex', alignItems: 'center' }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <Stack spacing={2.25}>
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: TRUIST.dusk }}>
                  Sign In
                </Typography>
               {/*  <Typography sx={{ mt: 0.75, fontSize: '28px', fontWeight: 700, color: TRUIST.charcoal, letterSpacing: '-0.03em' }}>
                  Continue to the dashboard
                </Typography> */}
              </Box>

              <TextField
                label="User ID"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                autoFocus
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    backgroundColor: TRUIST.paper,
                  },
                }}
              />

              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    backgroundColor: TRUIST.paper,
                  },
                }}
              />

              {error && (
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#b42318' }}>
                  {error}
                </Typography>
              )/*  : (
                <Typography sx={{ fontSize: '12px', color: TRUIST.muted }}>
                  Your user ID and persistent session ID will be reused for full-screen agent history.
                </Typography>
              ) */}

              <Button
                type="submit"
                variant="contained"
                size="large"
                endIcon={<LoginIcon sx={{ fontSize: 18 }} />}
                sx={{
                  mt: 1,
                  minHeight: 52,
                  borderRadius: 999,
                  backgroundColor: TRUIST.purple,
                  color: TRUIST.white,
                  fontSize: '14px',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: '#24143a',
                    boxShadow: 'none',
                  },
                }}
              >
                Login
              </Button>
            </Stack>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}