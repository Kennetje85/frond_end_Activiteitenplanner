
//nieuw object aangemaakt met de properties van een activiteit
type Activitys = {
    id?: number
    title: string
    description: string
}



function test() {
    const activiteit: Activitys = {
        title: 'Workshop IoT',
        description: 'Testbeschrijving',
    }

    return (
        <div className="Test">  
            <h1>{activiteit.title}</h1>
            <p>{activiteit.description}</p>
        </div>
    )
}   
      

export default test