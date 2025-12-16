// MCP Server SDK IMPORT
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { InferenceClient } from '@huggingface/inference'

// Optional: Configuration schema for user settings
export const configSchema = z.object({
    HF_TOKEN: z.string().describe('Hugging Face API 토큰 (이미지 생성에 필요)')
})

// Required: Export default createServer function for Smithery
export default function createServer({ config }: { config?: z.infer<typeof configSchema> }) {
// Create server instance
const server = new McpServer({
    name: 'my-mcp-server',
    version: '1.0.0'
})

// 핵심 기능 :: MCP 서버 도구 추가
// 1. 인사 도구
// description 을 자세히 적어줄 수록 적당한 시점에 실행을 해서 사용하게 된다.
// npx tsc로 타입스크립트를 build 하면 build 폴더에 결과물인 js가 나온다.
// mcp.json에서 mcp 서버 이름 설정하고 index.js build 파일 경로 설정해준다.
// cursor settings에서 mcp 껐다 키거나 하면 추가됨을 확인할 수 있다.
server.registerTool(
    'greet',
    {
        description: '이름과 언어를 입력하면 인사말을 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('인사할 사람의 이름'),
            language: z
                .enum(['ko', 'en'])
                .optional()
                .default('en')
                .describe('인사 언어 (기본값: en)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('인사말')
                    })
                )
                .describe('인사말')
        })
    },
    async ({ name, language }) => {
        const greeting =
            language === 'ko'
                ? `안녕하세요, ${name}님!`
                : `Hey there, ${name}! 👋 Nice to meet you!`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: greeting
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ]
            }
        }
    }
)

// 2. 계산기 도구
server.registerTool(
    'calculator',
    {
        description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
        inputSchema: z.object({
            number1: z.number().describe('첫 번째 숫자'),
            number2: z.number().describe('두 번째 숫자'),
            operator: z
                .enum(['+', '-', '*', '/'])
                .describe('연산자 (+, -, *, / 중 하나)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('계산 결과')
                    })
                )
                .describe('계산 결과')
        })
    },
    async ({ number1, number2, operator }) => {
        let result: number
        let operation: string

        switch (operator) {
            case '+':
                result = number1 + number2
                operation = '덧셈'
                break
            case '-':
                result = number1 - number2
                operation = '뺄셈'
                break
            case '*':
                result = number1 * number2
                operation = '곱셈'
                break
            case '/':
                if (number2 === 0) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: '오류: 0으로 나눌 수 없습니다.'
                            }
                        ],
                        structuredContent: {
                            content: [
                                {
                                    type: 'text' as const,
                                    text: '오류: 0으로 나눌 수 없습니다.'
                                }
                            ]
                        }
                    }
                }
                result = number1 / number2
                operation = '나눗셈'
                break
        }

        const resultText = `${number1} ${operator} ${number2} = ${result} (${operation})`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: resultText
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ]
            }
        }
    }
)

// 3. 현재 시간 도구
server.registerTool(
    'getCurrentTime',
    {
        description: '지정된 timezone의 현재 시간을 반환합니다. IANA timezone 형식을 사용합니다 (예: Asia/Seoul, America/New_York, Europe/London).',
        inputSchema: z.object({
            timezone: z
                .string()
                .optional()
                .default('Asia/Seoul')
                .describe('IANA timezone 이름 (예: Asia/Seoul, America/New_York, Europe/London). 기본값: Asia/Seoul')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('현재 시간 정보')
                    })
                )
                .describe('현재 시간 정보')
        })
    },
    async ({ timezone }) => {
        try {
            const now = new Date()
            const formatter = new Intl.DateTimeFormat('ko-KR', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            })

            const formattedTime = formatter.format(now)
            const resultText = `${timezone}의 현재 시간: ${formattedTime}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = `오류: 유효하지 않은 timezone입니다. (${timezone})`
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// 4. 지오코딩 도구 (Nominatim OpenStreetMap API)
server.registerTool(
    'geocode',
    {
        description: '도시 이름이나 주소를 입력받아 위도와 경도 좌표를 반환합니다. Nominatim OpenStreetMap API를 사용합니다.',
        inputSchema: z.object({
            query: z.string().describe('검색할 도시 이름이나 주소 (예: "Seoul", "New York", "서울시 강남구")')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('위도와 경도 좌표 정보')
                    })
                )
                .describe('위도와 경도 좌표 정보')
        })
    },
    async ({ query }) => {
        try {
            // Nominatim API 엔드포인트
            const baseUrl = 'https://nominatim.openstreetmap.org/search'
            const params = new URLSearchParams({
                q: query,
                format: 'jsonv2',
                limit: '1',
                addressdetails: '1'
            })

            const url = `${baseUrl}?${params.toString()}`
            
            // User-Agent 헤더는 Nominatim API 사용 정책에 따라 필수입니다
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MCP-Server/1.0.0'
                }
            })

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status}`)
            }

            const data = await response.json()

            if (!Array.isArray(data) || data.length === 0) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `검색 결과를 찾을 수 없습니다: "${query}"`
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: `검색 결과를 찾을 수 없습니다: "${query}"`
                            }
                        ]
                    }
                }
            }

            const result = data[0]
            const lat = parseFloat(result.lat)
            const lon = parseFloat(result.lon)
            const displayName = result.display_name || query

            const resultText = `위치: ${displayName}\n위도: ${lat}\n경도: ${lon}\n좌표: (${lat}, ${lon})`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error 
                ? `오류: ${error.message}` 
                : `오류: 지오코딩 요청 중 문제가 발생했습니다.`
            
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// 5. 날씨 정보 도구 (Open-Meteo Weather API)
server.registerTool(
    'getWeather',
    {
        description: '위도와 경도 좌표, 예보 기간을 입력받아 해당 위치의 현재 날씨와 예보 정보를 제공합니다. Open-Meteo Weather API를 사용합니다.',
        inputSchema: z.object({
            latitude: z.number().describe('위도 좌표'),
            longitude: z.number().describe('경도 좌표'),
            forecastDays: z
                .number()
                .int()
                .min(1)
                .max(16)
                .optional()
                .default(7)
                .describe('예보 기간 (일 단위, 1-16일, 기본값: 7일)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('날씨 정보')
                    })
                )
                .describe('날씨 정보')
        })
    },
    async ({ latitude, longitude, forecastDays }) => {
        try {
            const baseUrl = 'https://api.open-meteo.com/v1/forecast'
            const params = new URLSearchParams({
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                current_weather: 'true',
                hourly: 'temperature_2m,precipitation,weathercode',
                daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
                forecast_days: forecastDays.toString(),
                timezone: 'auto'
            })

            const url = `${baseUrl}?${params.toString()}`
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status}`)
            }

            const data = await response.json()

            if (!data.current_weather) {
                throw new Error('날씨 데이터를 가져올 수 없습니다.')
            }

            // 현재 날씨 정보
            const current = data.current_weather
            const currentTemp = current.temperature
            const currentWeatherCode = current.weathercode
            const currentWindSpeed = current.windspeed
            const currentWindDirection = current.winddirection

            // 날씨 코드를 텍스트로 변환하는 간단한 함수
            const getWeatherDescription = (code: number): string => {
                const weatherCodes: Record<number, string> = {
                    0: '맑음',
                    1: '대체로 맑음',
                    2: '부분적으로 흐림',
                    3: '흐림',
                    45: '안개',
                    48: '서리 안개',
                    51: '약한 이슬비',
                    53: '중간 이슬비',
                    55: '강한 이슬비',
                    56: '약한 동결 이슬비',
                    57: '강한 동결 이슬비',
                    61: '약한 비',
                    63: '중간 비',
                    65: '강한 비',
                    66: '약한 동결 비',
                    67: '강한 동결 비',
                    71: '약한 눈',
                    73: '중간 눈',
                    75: '강한 눈',
                    77: '눈알',
                    80: '약한 소나기',
                    81: '중간 소나기',
                    82: '강한 소나기',
                    85: '약한 눈 소나기',
                    86: '강한 눈 소나기',
                    95: '뇌우',
                    96: '우박과 함께하는 뇌우',
                    99: '강한 우박과 함께하는 뇌우'
                }
                return weatherCodes[code] || `날씨 코드: ${code}`
            }

            // 시간대별 예보 정보 (오늘과 내일 24시간)
            let hourlyForecast = ''
            if (data.hourly && data.hourly.time && data.hourly.temperature_2m) {
                hourlyForecast = '\n\n=== 시간대별 예보 (24시간) ===\n'
                const now = new Date()
                const currentHour = now.getHours()
                
                // 다음 24시간의 데이터만 표시
                for (let i = 0; i < Math.min(24, data.hourly.time.length); i++) {
                    const timeStr = data.hourly.time[i]
                    const time = new Date(timeStr)
                    const hour = time.getHours()
                    const temp = data.hourly.temperature_2m[i]
                    const precipitation = data.hourly.precipitation?.[i] || 0
                    const weatherCode = data.hourly.weathercode?.[i] || 0
                    
                    // 날짜가 바뀌면 날짜 표시
                    const dateStr = time.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                    const timeLabel = `${dateStr} ${hour.toString().padStart(2, '0')}:00`
                    
                    hourlyForecast += `${timeLabel} | 온도: ${temp}°C | 강수: ${precipitation}mm | ${getWeatherDescription(weatherCode)}\n`
                }
            }

            // 일별 예보 정보
            let dailyForecast = ''
            if (data.daily && data.daily.time) {
                dailyForecast = '\n\n=== 일별 예보 ===\n'
                for (let i = 0; i < Math.min(forecastDays, data.daily.time.length); i++) {
                    const date = data.daily.time[i]
                    const maxTemp = data.daily.temperature_2m_max[i]
                    const minTemp = data.daily.temperature_2m_min[i]
                    const precipitation = data.daily.precipitation_sum[i]
                    const weatherCode = data.daily.weathercode[i]
                    
                    dailyForecast += `\n${date}\n`
                    dailyForecast += `  날씨: ${getWeatherDescription(weatherCode)}\n`
                    dailyForecast += `  최고기온: ${maxTemp}°C\n`
                    dailyForecast += `  최저기온: ${minTemp}°C\n`
                    dailyForecast += `  강수량: ${precipitation}mm\n`
                }
            }

            const resultText = `=== 현재 날씨 ===
위치: 위도 ${latitude}, 경도 ${longitude}
온도: ${currentTemp}°C
날씨: ${getWeatherDescription(currentWeatherCode)}
풍속: ${currentWindSpeed} km/h
풍향: ${currentWindDirection}°
${hourlyForecast}${dailyForecast}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error 
                ? `오류: ${error.message}` 
                : `오류: 날씨 정보 요청 중 문제가 발생했습니다.`
            
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// 6. 이미지 생성 도구 (Hugging Face Inference API)
server.registerTool(
    'generateImage',
    {
        description: '텍스트 프롬프트를 입력받아 AI로 생성된 이미지를 base64 형식으로 반환합니다. Hugging Face FLUX.1-schnell 모델을 사용합니다.',
        inputSchema: z.object({
            prompt: z.string().describe('이미지를 생성할 텍스트 프롬프트')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('image'),
                        data: z.string().describe('base64로 인코딩된 이미지 데이터'),
                        mimeType: z.string().describe('이미지 MIME 타입'),
                        annotations: z
                            .object({
                                audience: z.array(z.string()).optional(),
                                priority: z.number().optional()
                            })
                            .optional()
                    })
                )
                .describe('생성된 이미지')
        })
    },
    async ({ prompt }) => {
        try {
            // Hugging Face API 토큰 확인 (config 또는 환경 변수에서 가져오기)
            const hfToken = config?.HF_TOKEN || process.env.HF_TOKEN
            if (!hfToken) {
                throw new Error('HF_TOKEN 환경 변수 또는 설정이 필요합니다.')
            }

            const client = new InferenceClient(hfToken)

            // 이미지 생성
            const imageBlob = await client.textToImage({
                provider: 'auto',
                model: 'black-forest-labs/FLUX.1-schnell',
                inputs: prompt,
                parameters: { num_inference_steps: 5 }
            })

            // Blob 또는 Response를 base64로 변환
            let base64Data: string
            const blob = imageBlob as unknown
            
            if (blob instanceof Blob) {
                const arrayBuffer = await blob.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                base64Data = buffer.toString('base64')
            } else if (blob instanceof Response) {
                const arrayBuffer = await blob.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                base64Data = buffer.toString('base64')
            } else if (typeof blob === 'string') {
                // 문자열인 경우
                const buffer = Buffer.from(blob, 'binary')
                base64Data = buffer.toString('base64')
            } else {
                // 기타 경우: arrayBuffer 메서드가 있는지 확인
                const arrayBuffer = await (blob as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                base64Data = buffer.toString('base64')
            }

            // base64 인코딩된 이미지 데이터 반환
            return {
                content: [
                    {
                        type: 'image' as const,
                        data: base64Data,
                        mimeType: 'image/png',
                        annotations: {
                            audience: ['user'],
                            priority: 0.9
                        }
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'image' as const,
                            data: base64Data,
                            mimeType: 'image/png',
                            annotations: {
                                audience: ['user'],
                                priority: 0.9
                            }
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error 
                ? `오류: ${error.message}` 
                : `오류: 이미지 생성 중 문제가 발생했습니다.`
            
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: errorMessage
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: errorMessage
                        }
                    ]
                }
            }
        }
    }
)

// MCP Resource: 서버 정보 및 도구 정보
server.registerResource(
    'server-info',
    'mcp://my-mcp-server/info',
    {
        description: 'MCP 서버의 현재 상태, 버전, 도구 목록 등의 정보를 제공합니다.',
        mimeType: 'application/json'
    },
    async () => {
        // 등록된 도구 목록 수집
        const toolsList = [
            {
                name: 'greet',
                description: '이름과 언어를 입력하면 인사말을 반환합니다.'
            },
            {
                name: 'calculator',
                description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.'
            },
            {
                name: 'getCurrentTime',
                description: '지정된 timezone의 현재 시간을 반환합니다.'
            },
            {
                name: 'geocode',
                description: '도시 이름이나 주소를 입력받아 위도와 경도 좌표를 반환합니다.'
            },
            {
                name: 'getWeather',
                description: '위도와 경도 좌표, 예보 기간을 입력받아 해당 위치의 현재 날씨와 예보 정보를 제공합니다.'
            },
            {
                name: 'generateImage',
                description: '텍스트 프롬프트를 입력받아 AI로 생성된 이미지를 base64 형식으로 반환합니다.'
            }
        ]

        const serverInfo = {
            server: {
                name: 'my-mcp-server',
                version: '1.0.0',
                description: 'MCP 서버 - 인사, 계산기, 시간, 지오코딩, 날씨 정보 제공'
            },
            tools: toolsList,
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        }

        return {
            contents: [
                {
                    uri: 'mcp://my-mcp-server/info',
                    mimeType: 'application/json',
                    text: JSON.stringify(serverInfo, null, 2)
                }
            ]
        }
    }
)

// MCP Prompt: 코드 리뷰 프롬프트
server.registerPrompt(
    'code-review',
    {
        description: '사용자가 제공한 코드를 기반으로 코드 리뷰를 수행하는 프롬프트를 생성합니다.',
        argsSchema: z.object({
            code: z.string().describe('리뷰할 코드'),
            language: z.string().optional().describe('프로그래밍 언어 (예: TypeScript, JavaScript, Python 등)')
        })
    },
    async ({ code, language }) => {
        // 코드 리뷰 프롬프트 템플릿
        const codeReviewTemplate = `# 코드 리뷰 요청

**프로그래밍 언어**: ${language || '알 수 없음'}

아래의 코드를 리뷰해 주세요:

\`\`\`${language || ''}
${code}
\`\`\`

## 리뷰 지침

다음 항목들을 중심으로 코드를 리뷰해 주세요:

1. **가독성과 유지보수성**
   - 코드가 읽기 쉽고 이해하기 쉬운가요?
   - 변수명과 함수명이 명확한가요?
   - 주석이 적절하게 작성되어 있나요?

2. **버그 및 문제점**
   - 잠재적인 버그나 런타임 오류가 있나요?
   - 예외 처리가 적절하게 되어 있나요?
   - 엣지 케이스가 고려되어 있나요?

3. **성능**
   - 성능 개선이 필요한 부분이 있나요?
   - 불필요한 연산이나 중복 코드가 있나요?
   - 알고리즘의 시간 복잡도가 최적화되어 있나요?

4. **보안**
   - 보안 취약점이 있나요?
   - 입력값 검증이 적절하게 이루어지고 있나요?
   - 민감한 정보가 노출되지 않았나요?

5. **모범 사례**
   - 해당 언어의 모범 사례를 따르고 있나요?
   - 코드 스타일이 일관성 있게 작성되어 있나요?
   - 설계 패턴이 적절하게 적용되어 있나요?

6. **개선 제안**
   - 코드를 더 나은 방향으로 개선할 수 있는 구체적인 제안을 해 주세요.
   - 리팩토링이 필요한 부분이 있다면 알려 주세요.

감사합니다.`

        return {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: codeReviewTemplate
                    }
                }
            ]
        }
    }
)

    // Must return the MCP server object for Smithery
    return server.server
}

// Local development: Only start stdio transport when running directly (not imported by Smithery)
// Smithery imports this module, so we check if we're being run directly
// When imported as a module by Smithery, this code should not execute
// We check if process.argv[1] matches our entry point file
const isDirectExecution = process.argv[1] && (
    process.argv[1].endsWith('index.js') || 
    process.argv[1].endsWith('index.ts') ||
    process.argv[1].includes('build/index.js') ||
    process.argv[1].includes('src/index.ts')
) && !process.env.SMITHERY_DEPLOYMENT

if (isDirectExecution) {
    const server = createServer({ config: undefined })
    server
        .connect(new StdioServerTransport())
        .catch(console.error)
        .then(() => {
            console.error('MCP server started (local mode)')
        })
}
