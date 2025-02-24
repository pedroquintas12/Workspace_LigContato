def formatar_data(data):
    if data:
        return data.strftime("%d/%m/%Y %H:%M:%S")
    return None

def formartar_data_AMD(data):
    if data:
        return data.strftime("%d/%m/%Y")
    return None